using System.Security.Claims;
using Api.DTOs;
using Api.Helpers;
using Api.Services;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TicketPausesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<TicketPausesController> _logger;
        private readonly ICacheService _cache;

        public TicketPausesController(
            AppDbContext context,
            ILogger<TicketPausesController> logger,
            ICacheService cache
        )
        {
            _context = context;
            _logger = logger;
            _cache = cache;
        }

        private long GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.Parse(userIdClaim!);
        }

        private async Task InvalidatePauseCacheAsync(long ticketId, long? pauseId = null)
        {
            // Invalidate pause list
            await _cache.RemoveByPatternAsync(CacheKeys.TicketPauses.List());

            // Invalidate specific pause if provided
            if (pauseId.HasValue)
            {
                await _cache.RemoveAsync(CacheKeys.TicketPauses.Detail(pauseId.Value));
            }

            // Invalidate pauses for this ticket
            await _cache.RemoveAsync(CacheKeys.TicketPauses.ByTicket(ticketId));

            // Invalidate ticket cache (pause affects ticket)
            await _cache.RemoveAsync(CacheKeys.Tickets.Detail(ticketId));
            await _cache.RemoveByPatternAsync(CacheKeys.Tickets.List());

            _logger.LogDebug($"Invalidated pause cache for ticket {ticketId}");
        }

        // GET: /api/TicketPauses
        [HttpGet]
        public async Task<ActionResult<List<TicketPauseListItem>>> GetAllPauses(
            [FromQuery] bool? activeOnly = null
        )
        {
            var query = _context
                .TicketPauses.Include(tp => tp.Ticket)
                .Include(tp => tp.PausedByUser)
                .Include(tp => tp.ResumedByUser)
                .AsQueryable();

            if (activeOnly == true)
            {
                query = query.Where(tp => tp.ResumedAt == null);
            }

            var pauses = await query.OrderByDescending(tp => tp.PausedAt).ToListAsync();

            var result = pauses
                .Select(tp => new TicketPauseListItem(
                    tp.Id,
                    tp.TicketId,
                    tp.Ticket.ExternalCode,
                    tp.PausedAt,
                    tp.ResumedAt,
                    tp.PauseReason,
                    tp.ResumeNotes,
                    tp.PausedByUser.DisplayName,
                    tp.ResumedByUser?.DisplayName,
                    tp.ResumedAt == null,
                    (int)CalculateDurationHours(tp.PausedAt, tp.ResumedAt)
                ))
                .ToList();

            return Ok(result);
        }

        // GET: /api/TicketPauses/ticket/{ticketId}
        [HttpGet("ticket/{ticketId}")]
        public async Task<ActionResult<List<TicketPauseDetail>>> GetTicketPauses(long ticketId)
        {
            var pauses = await _context
                .TicketPauses.Include(tp => tp.Ticket)
                .Include(tp => tp.PausedByUser)
                .Include(tp => tp.ResumedByUser)
                .Where(tp => tp.TicketId == ticketId)
                .OrderByDescending(tp => tp.PausedAt)
                .ToListAsync();

            var result = pauses
                .Select(tp => new TicketPauseDetail(
                    tp.Id,
                    tp.TicketId,
                    tp.Ticket.ExternalCode,
                    tp.Ticket.Title,
                    tp.PausedAt,
                    tp.ResumedAt,
                    tp.PauseReason,
                    tp.ResumeNotes,
                    tp.PausedByUserId,
                    tp.PausedByUser.DisplayName,
                    tp.ResumedByUserId,
                    tp.ResumedByUser?.DisplayName,
                    tp.CreatedAt
                ))
                .ToList();

            return Ok(result);
        }

        // GET: /api/TicketPauses/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<TicketPauseDetail>> GetPause(long id)
        {
            var pause = await _context
                .TicketPauses.Include(tp => tp.Ticket)
                .Include(tp => tp.PausedByUser)
                .Include(tp => tp.ResumedByUser)
                .FirstOrDefaultAsync(tp => tp.Id == id);

            if (pause == null)
                return NotFound();

            var result = new TicketPauseDetail(
                pause.Id,
                pause.TicketId,
                pause.Ticket.ExternalCode,
                pause.Ticket.Title,
                pause.PausedAt,
                pause.ResumedAt,
                pause.PauseReason,
                pause.ResumeNotes,
                pause.PausedByUserId,
                pause.PausedByUser.DisplayName,
                pause.ResumedByUserId,
                pause.ResumedByUser?.DisplayName,
                pause.CreatedAt
            );
            await InvalidateTicketListCacheAsync();
            await InvalidateTicketDetailCacheAsync(id);
            await InvalidateRecentActivities();
            return Ok(result);
        }

        // POST: /api/TicketPauses
        [HttpPost]
        [Authorize(Roles = "Editor,Admin")]
        public async Task<ActionResult<TicketPauseDetail>> CreatePause(
            [FromBody] CreateTicketPauseRequest request
        )
        {
            var ticket = await _context.Tickets.FindAsync(request.TicketId);

            if (ticket == null)
                return NotFound(new { message = "Ticket bulunamadı" });

            if (ticket.Status == TicketStatus.PAUSED)
                return BadRequest(new { message = "Ticket zaten duraklatılmış durumda" });

            var userId = GetCurrentUserId();

            // Create pause record
            var pause = new TicketPause
            {
                TicketId = request.TicketId,
                PausedByUserId = userId,
                PausedAt = DateTime.UtcNow,
                PauseReason = request.PauseReason,
                CreatedAt = DateTime.UtcNow,
            };

            _context.TicketPauses.Add(pause);

            // Update ticket status
            ticket.Status = TicketStatus.PAUSED;
            ticket.UpdatedAt = DateTime.UtcNow;
            ticket.LastUpdatedById = userId;

            // Log action
            var action = new TicketAction
            {
                TicketId = request.TicketId,
                ActionType = ActionType.StatusChange,
                FromStatus = ticket.Status,
                ToStatus = TicketStatus.PAUSED,
                Notes = $"Duraklama Sebebi: {request.PauseReason}",
                PerformedById = userId,
                PerformedAt = DateTime.UtcNow,
            };

            _context.TicketActions.Add(action);

            await _context.SaveChangesAsync();

            await InvalidatePauseCacheAsync(request.TicketId, pause.Id);
            await InvalidateTicketListCacheAsync();
            await InvalidateTicketDetailCacheAsync(request.TicketId);
            await InvalidateRecentActivities();

            _logger.LogInformation($"Ticket {request.TicketId} paused by user {userId}");

            // Return created pause
            var createdPause = await GetPause(pause.Id);
            return CreatedAtAction(nameof(GetPause), new { id = pause.Id }, createdPause.Value);
        }

        // POST: /api/TicketPauses/{id}/resume
        [HttpPost("{id}/resume")]
        [Authorize(Roles = "Editor,Admin")]
        public async Task<ActionResult> ResumePause(
            long id,
            [FromBody] ResumeTicketPauseRequest request
        )
        {
            var pause = await _context
                .TicketPauses.Include(tp => tp.Ticket)
                .FirstOrDefaultAsync(tp => tp.Id == id);

            if (pause == null)
                return NotFound(new { message = "Pause kaydı bulunamadı" });

            if (pause.ResumedAt.HasValue)
                return BadRequest(new { message = "Bu pause zaten sonlandırılmış" });

            var userId = GetCurrentUserId();

            // Update pause record
            pause.ResumedAt = DateTime.UtcNow;
            pause.ResumedByUserId = userId;
            pause.ResumeNotes = request.ResumeNotes;

            // Update ticket status back to OPEN
            pause.Ticket.Status = TicketStatus.REOPENED;
            pause.Ticket.UpdatedAt = DateTime.UtcNow;
            pause.Ticket.LastUpdatedById = userId;

            // Log action
            var action = new TicketAction
            {
                TicketId = pause.TicketId,
                ActionType = ActionType.StatusChange,
                FromStatus = TicketStatus.PAUSED,
                ToStatus = TicketStatus.OPEN,
                Notes = request.ResumeNotes ?? "Duraklama sonlandırıldı",
                PerformedById = userId,
                PerformedAt = DateTime.UtcNow,
            };

            _context.TicketActions.Add(action);

            await _context.SaveChangesAsync();
            await InvalidatePauseCacheAsync(pause.TicketId, id);

            await InvalidateTicketListCacheAsync();
            await InvalidateTicketDetailCacheAsync(pause.TicketId);
            await InvalidateRecentActivities();

            _logger.LogInformation($"Pause {id} resumed by user {userId}");

            return Ok(new { message = "Duraklama sonlandırıldı" });
        }

        // PUT: /api/TicketPauses/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = "Editor,Admin")]
        public async Task<ActionResult> UpdatePause(
            long id,
            [FromBody] UpdateTicketPauseRequest request
        )
        {
            var pause = await _context.TicketPauses.FindAsync(id);

            if (pause == null)
                return NotFound();

            pause.PauseReason = request.PauseReason;
            pause.ResumeNotes = request.ResumeNotes;

            await _context.SaveChangesAsync();
            await InvalidatePauseCacheAsync(pause.TicketId, id);
            await InvalidateTicketListCacheAsync();
            await InvalidateRecentActivities();
            await InvalidateTicketDetailCacheAsync(pause.TicketId);

            return Ok(new { message = "Pause bilgileri güncellendi" });
        }

        // DELETE: /api/TicketPauses/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeletePause(long id)
        {
            var pause = await _context.TicketPauses.FindAsync(id);

            if (pause == null)
                return NotFound();

            var ticketId = pause.TicketId;

            _context.TicketPauses.Remove(pause);
            await _context.SaveChangesAsync();
            await InvalidatePauseCacheAsync(ticketId, id);
            await InvalidateRecentActivities();

            return Ok(new { message = "Pause kaydı silindi" });
        }

        private int CalculateDurationDays(DateTime start, DateTime? end)
        {
            var endDate = end ?? DateTime.UtcNow;
            return (int)(endDate - start).TotalDays;
        }

        private double CalculateDurationHours(DateTime start, DateTime? end)
        {
            var endDate = end ?? DateTime.UtcNow;
            return (endDate - start).TotalHours;
        }

        //Helper functions for cache invalidation
        private Task InvalidateTicketDetailCacheAsync(long id) =>
            _cache.RemoveAsync($"tickets:detail:{id}");

        private async Task InvalidateRecentActivities()
        {
            await _cache.RemoveAsync("tickets:recent-activities");
        }

        private async Task InvalidateTicketListCacheAsync()
        {
            // all tickets, with/without deleted
            await _cache.RemoveAsync("tickets:list:all:False");
            await _cache.RemoveAsync("tickets:list:all:True");

            // each status
            foreach (var statusName in Enum.GetNames<TicketStatus>())
            {
                await _cache.RemoveAsync($"tickets:list:{statusName}:False");
                await _cache.RemoveAsync($"tickets:list:{statusName}:True");
            }
        }
    }
}
