using System.Security.Claims;
using Api.DTOs;
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
    public class ProgressRequestsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<ProgressRequestsController> _logger;
        private readonly ICacheService _cache;

        public ProgressRequestsController(
            AppDbContext context,
            ILogger<ProgressRequestsController> logger,
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

        /// <summary>
        /// Get all progress requests (paginated)
        /// </summary>
        // GET: /api/ProgressRequests/{id}/cancel
        [HttpGet]
        [Authorize(Roles = "Editor,Admin,Viewer")]
        public async Task<ActionResult<List<ProgressRequestListItem>>> GetProgressRequests(
            [FromQuery] string? status = null,
            [FromQuery] bool? myRequests = null,
            [FromQuery] bool? assignedToMe = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50
        )
        {
            var userId = GetCurrentUserId();

            var query = _context
                .ProgressRequests.Include(pr => pr.Ticket)
                .Include(pr => pr.RequestedBy)
                .Include(pr => pr.TargetUser)
                .Include(pr => pr.RespondedBy)
                .Include(pr => pr.Updates)
                .AsQueryable();

            // Filter by status
            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(pr => pr.Status == status);
            }

            // Filter: my requests
            if (myRequests == true)
            {
                query = query.Where(pr => pr.RequestedByUserId == userId);
            }

            // Filter: assigned to me
            if (assignedToMe == true)
            {
                query = query.Where(pr => pr.TargetUserId == userId);
            }

            var progressRequests = await query
                .OrderByDescending(pr => pr.RequestedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var result = progressRequests
                .Select(pr => new ProgressRequestListItem(
                    pr.Id,
                    pr.TicketId,
                    pr.Ticket.ExternalCode,
                    pr.Ticket.Title,
                    pr.RequestedByUserId,
                    pr.RequestedBy.DisplayName,
                    pr.TargetUserId,
                    pr.TargetUser.DisplayName,
                    pr.RequestMessage,
                    pr.RequestedAt,
                    pr.DueDate,
                    pr.ProgressInfo,
                    pr.IsResponded,
                    pr.RespondedAt,
                    pr.RespondedBy?.DisplayName,
                    pr.Status,
                    pr.DueDate.HasValue && pr.DueDate.Value < DateTime.UtcNow && !pr.IsResponded,
                    pr.ProgressPercentage,
                    pr.EstimatedCompletion,
                    pr.Updates.Count,
                    pr.Updates.OrderByDescending(u => u.UpdatedAt)
                        .Select(u => new ProgressRequestUpdateItem(
                            u.Id,
                            u.ProgressRequestId,
                            u.UpdatedByUserId,
                            u.UpdatedBy.DisplayName,
                            u.ProgressInfo,
                            u.ProgressPercentage,
                            u.EstimatedCompletion,
                            u.UpdatedAt
                        ))
                        .ToList()
                ))
                .ToList();

            return Ok(result);
        }

        /// <summary>
        /// Get progress request by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<List<ProgressRequestDetail>>> GetTicketProgressRequests(
            long id
        )
        {
            var progressRequest = await _context
                .ProgressRequests.Include(pr => pr.Ticket)
                .Include(pr => pr.RequestedBy)
                .Include(pr => pr.TargetUser)
                .Include(pr => pr.RespondedBy)
                .Include(pr => pr.ResponseAction)
                .Include(pr => pr.Updates)
                    .ThenInclude(u => u.UpdatedBy)
                .Where(pr => pr.TicketId == id)
                .OrderByDescending(pr => pr.RequestedAt)
                .ToListAsync();

            if (!progressRequest.Any())
                return Ok(new List<ProgressRequestDetail>());

            var result = progressRequest
                .Select(pr => new ProgressRequestDetail(
                    pr.Id,
                    pr.TicketId,
                    pr.Ticket.ExternalCode,
                    pr.Ticket.Title,
                    pr.RequestedByUserId,
                    pr.RequestedBy.DisplayName,
                    pr.TargetUserId,
                    pr.TargetUser.DisplayName,
                    pr.RequestMessage,
                    pr.RequestedAt,
                    pr.DueDate,
                    pr.ProgressInfo,
                    pr.IsResponded,
                    pr.RespondedAt,
                    pr.RespondedByUserId,
                    pr.RespondedBy?.DisplayName,
                    pr.ResponseActionId,
                    pr.ResponseAction?.Notes,
                    pr.Status,
                    pr.NotificationId,
                    pr.ProgressPercentage,
                    pr.EstimatedCompletion,
                    pr.Updates.OrderByDescending(u => u.UpdatedAt)
                        .Select(u => new ProgressRequestUpdateItem(
                            u.Id,
                            u.ProgressRequestId,
                            u.UpdatedByUserId,
                            u.UpdatedBy.DisplayName,
                            u.ProgressInfo,
                            u.ProgressPercentage,
                            u.EstimatedCompletion,
                            u.UpdatedAt
                        ))
                        .ToList()
                ))
                .ToList();

            return Ok(result);
        }

        /// <summary>
        /// Provide progress update
        /// </summary>
        [HttpPost("{id}/update-progress")]
        [Authorize(Roles = "Editor,Admin")]
        public async Task<ActionResult> UpdateProgress(
            long id,
            [FromBody] UpdateProgressRequest request
        )
        {
            var progressRequest = await _context
                .ProgressRequests.Include(pr => pr.Ticket)
                .Include(pr => pr.RequestedBy)
                .FirstOrDefaultAsync(pr => pr.Id == id);

            if (progressRequest == null)
                return NotFound(new { message = "Progress request bulunamadı" });

            var userId = GetCurrentUserId();

            var progressUpdate = new ProgressRequestUpdate
            {
                ProgressRequestId = progressRequest.Id,
                UpdatedByUserId = userId,
                ProgressInfo = request.ProgressInfo,
                ProgressPercentage = request.ProgressPercentage,
                EstimatedCompletion = request.EstimatedCompletion.HasValue
                    ? DateTime.SpecifyKind(request.EstimatedCompletion.Value, DateTimeKind.Utc)
                    : null,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.ProgressRequestUpdates.Add(progressUpdate);

            // Update progress information (no ResponseActionId needed)
            progressRequest.ProgressInfo = request.ProgressInfo;
            progressRequest.ProgressPercentage = request.ProgressPercentage;
            progressRequest.EstimatedCompletion = progressUpdate.EstimatedCompletion;
            progressRequest.Status = "InProgress";

            if (request.EstimatedCompletion.HasValue)
            {
                progressRequest.EstimatedCompletion = DateTime.SpecifyKind(
                    request.EstimatedCompletion.Value,
                    DateTimeKind.Utc
                );
            }

            // Optional: Also create a ticket action for audit trail

            var auxiliaryContext =
                $"{request.ProgressInfo} - % {request.ProgressPercentage} - Tahmini Tamamlanma: {request.EstimatedCompletion} ";

            var Comment = new TicketComment
            {
                TicketId = progressRequest.TicketId,
                Body = $"Bilgi Talebi  Güncellendi: {auxiliaryContext}",
                CreatedById = userId,
                CreatedAt = DateTime.UtcNow,
            };

            var action = new TicketAction
            {
                TicketId = progressRequest.TicketId,
                ActionType = ActionType.Comment,
                Notes = $"Bilgi Talebi  Güncellendi: {auxiliaryContext}",
                PerformedById = userId,
                PerformedAt = DateTime.UtcNow,
            };

            _context.TicketActions.Add(action);
            _context.TicketComments.Add(Comment);

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Progress updated for request {id} by user {userId}");
            await InvalidateTicketListCacheAsync();
            await InvalidateTicketDetailCacheAsync(id);
            return Ok(new { message = "Bilgi talebi güncellendi" });
        }

        /// <summary>
        /// Respond to a progress request
        /// </summary>
        [HttpPost("{id}/respond")]
        [Authorize(Roles = "Editor,Admin")]
        public async Task<ActionResult> RespondToRequest(
            long id,
            [FromBody] RespondToProgressRequest request
        )
        {
            var progressRequest = await _context
                .ProgressRequests.Include(pr => pr.Ticket)
                .Include(pr => pr.RequestedBy)
                .FirstOrDefaultAsync(pr => pr.Id == id);

            if (progressRequest == null)
                return NotFound(new { message = "Progress request bulunamadı" });

            if (progressRequest.IsResponded)
                return BadRequest(new { message = "Bu talep zaten yanıtlanmış" });

            var userId = GetCurrentUserId();

            var finalUpdate = new ProgressRequestUpdate
            {
                ProgressRequestId = progressRequest.Id,
                UpdatedByUserId = userId,
                ProgressInfo = request.ResponseNotes,
                ProgressPercentage = 100, // Assuming completion
                UpdatedAt = DateTime.UtcNow,
            };

            // Create ticket action FIRST
            var action = new TicketAction
            {
                TicketId = progressRequest.TicketId,
                ActionType = ActionType.Comment,
                Notes = $"Bilgi Talebi Yanıtlandı: {request.ResponseNotes}",
                PerformedById = userId,
                PerformedAt = DateTime.UtcNow,
            };

            _context.TicketActions.Add(action);

            // Mark as responded

            progressRequest.IsResponded = true;
            progressRequest.RespondedAt = DateTime.UtcNow;
            progressRequest.RespondedByUserId = userId;
            progressRequest.ProgressInfo = request.ResponseNotes;
            // progressRequest.ResponseActionId = action.Id;

            progressRequest.Status = "Responded";

            await _context.SaveChangesAsync();

            // Send notification
            // await _notificationService.CreateProgressResponseNotification(
            //     progressRequest.TicketId,
            //     progressRequest.RequestedByUserId,
            //     userId
            // );

            await InvalidateTicketListCacheAsync();
            await InvalidateTicketDetailCacheAsync(id);

            _logger.LogInformation($"Progress request {id} responded by user {userId}");

            return Ok(new { message = "Talep yanıtlandı" });
        }

        // POST: /api/ProgressRequests/{id}/cancel
        [HttpPost("{id}/cancel")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> CancelRequest(long id)
        {
            var request = await _context.ProgressRequests.FindAsync(id);

            if (request == null)
                return NotFound();

            request.Status = "Cancelled";
            await _context.SaveChangesAsync();
            await InvalidateTicketListCacheAsync();
            await InvalidateTicketDetailCacheAsync(id);

            return Ok(new { message = "Talep iptal edildi" });
        }

        // DELETE: /api/ProgressRequests/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteRequest(long id)
        {
            var request = await _context.ProgressRequests.FindAsync(id);

            if (request == null)
                return NotFound();

            _context.ProgressRequests.Remove(request);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Talep silindi" });
        }

        private Task InvalidateTicketDetailCacheAsync(long id) =>
            _cache.RemoveAsync($"tickets:detail:{id}");

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
