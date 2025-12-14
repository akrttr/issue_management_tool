using System.Security.Claims;
using Api.DTOs;
using Api.Helpers;
using Api.Services;
using Application.Services;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TicketsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly TicketService _ticketService;
    private readonly ExcelExportService _excelExportService;
    private readonly ICacheService _cache;
    private readonly NotificationService _notificationService;
    private readonly ILogger<TicketsController> _logger;

    public TicketsController(
        AppDbContext context,
        TicketService ticketService,
        ExcelExportService excelExportService,
        ICacheService cache,
        NotificationService notificationService,
        ILogger<TicketsController> logger
    )
    {
        _context = context;
        _ticketService = ticketService;
        _excelExportService = excelExportService;
        _cache = cache;
        _notificationService = notificationService;
        _logger = logger;
    }

    private long GetCurrentUserId() => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private async Task InvalidateTicketCacheAsync(long ticketId)
    {
        await _cache.RemoveAsync(CacheKeys.Tickets.Detail(ticketId));
        await _cache.RemoveByPatternAsync(CacheKeys.Tickets.List());
        await _cache.RemoveByPatternAsync(CacheKeys.TicketPauses.ByTicket(ticketId));
        _logger.LogDebug($"Invalidated cache for ticket {ticketId}");
    }

    /// <summary>
    /// Get available systems for dropdown
    /// </summary>
    [HttpGet("system")]
    public async Task<ActionResult<List<SystemOption>>> GetAvailableSystems()
    {
        const string cacheKey = "tickets:dropdown:systems";
        var cached = await _cache.GetAsync<List<SystemOption>>(cacheKey);
        if (cached != null)
            return Ok(cached);

        var systems = await _context
            .Systems.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new SystemOption(s.Id, s.Name))
            .ToListAsync();

        return Ok(systems);
    }

    /// <summary>
    /// Get available subsystems for dropdown (optionally filtered by system)
    /// </summary>
    [HttpGet("subsystem")]
    public async Task<ActionResult<List<SubsystemOption>>> GetAvailableSubsystems(
        [FromQuery] long? systemId = null
    )
    {
        var cacheKey = $"tickets:dropdown:subsystems:{systemId?.ToString() ?? "all"}";

        var cached = await _cache.GetAsync<List<SubsystemOption>>(cacheKey);
        if (cached != null)
            return Ok(cached);

        IQueryable<Subsystem> query = _context.Subsystems.AsNoTracking();

        if (systemId.HasValue)
        {
            query = query.Where(s => s.SystemId == systemId.Value);
        }

        var subsystems = await query
            .OrderBy(s => s.Name)
            .Select(s => new SubsystemOption(s.Id, s.Name, s.SystemId))
            .ToListAsync();
        await _cache.SetAsync(cacheKey, subsystems, TimeSpan.FromHours(1));

        return Ok(subsystems);
    }

    /// <summary>
    /// Get recent activities across all tickets for the timeline
    /// </summary>
    [HttpGet("recent-activities")]
    public async Task<ActionResult<List<RecentActivityItem>>> GetRecentActivities([FromQuery] int limit = 20)
    {
        var cacheKey = $"tickets:recent-activities:{limit}";

        var cached = await _cache.GetAsync<List<RecentActivityItem>>(cacheKey);
        if (cached != null)
            return Ok(cached);

        var recentActions = await _context.TicketActions.Include(a => a.Ticket)
            .Include(a => a.PerformedBy)
                .ThenInclude(u => u.MilitaryRank)
            .Where(a => !a.Ticket.IsDeleted) // Only show actions from non-deleted tickets
            .OrderByDescending(a => a.PerformedAt)
            .Take(limit)
            .Select(a => new RecentActivityItem(
                a.Id,
                a.TicketId,
                a.Ticket.ExternalCode,
                a.Ticket.Title,
                a.ActionType.ToString(),
                a.FromStatus != null ? a.FromStatus.ToString() : null,
                a.ToStatus != null ? a.ToStatus.ToString() : null,
                a.Notes,
                a.PerformedBy.DisplayName,
                a.PerformedBy.MilitaryRank != null ? a.PerformedBy.MilitaryRank.DisplayName : null,
                a.PerformedAt
            ))
            .ToListAsync();

        await _cache.SetAsync(cacheKey, recentActions, TimeSpan.FromMinutes(5));

        return Ok(recentActions);
    }


    /// <summary>
    /// Get available CIs for dropdown (optionally filtered by subsystem)
    /// </summary>
    [HttpGet("ci")]
    public async Task<ActionResult<List<CIOption>>> GetAvailableCIs(
        [FromQuery] long? subsystemId = null
    )
    {
        var cacheKey = $"tickets:dropdown:cis:{subsystemId?.ToString() ?? "all"}";

        var cached = await _cache.GetAsync<List<CIOption>>(cacheKey);
        if (cached != null)
            return Ok(cached);

        var query = _context.ConfigurationItems;

        var cis = await query
            .OrderBy(ci => ci.Name)
            .Select(ci => new CIOption(ci.Id, ci.Name))
            .ToListAsync();

        await _cache.SetAsync(cacheKey, cis, TimeSpan.FromHours(1));

        return Ok(cis);
    }

    /// <summary>
    /// Get available components for dropdown (optionally filtered by CI)
    /// </summary>
    [HttpGet("component")]
    public async Task<ActionResult<List<ComponentOption>>> GetAvailableComponents(
        [FromQuery] long? subsystemID = null
    )
    {
        var cacheKey = $"tickets:dropdown:components:{subsystemID?.ToString() ?? "all"}";

        var cached = await _cache.GetAsync<List<ComponentOption>>(cacheKey);
        if (cached != null)
            return Ok(cached);

        // var query = _context.Components;
        IQueryable<Component> query = _context.Components.AsNoTracking();

        if (subsystemID.HasValue)
        {
            query = query.Where(c => c.SubsystemId == subsystemID.Value);
        }

        var components = await query
            .OrderBy(c => c.Name)
            .Select(c => new ComponentOption(c.Id, c.Name, c.SubsystemId))
            .ToListAsync();

        await _cache.SetAsync(cacheKey, components, TimeSpan.FromHours(1));

        return Ok(components);
    }

    [HttpGet]
    public async Task<ActionResult<List<TicketListItem>>> GetTickets(
        [FromQuery] string? status = null,
        [FromQuery] bool includeDeleted = false
    )
    {
        var cacheKey = $"tickets:list:{status ?? "all"}:{includeDeleted}";

        var cached = await _cache.GetAsync<List<TicketListItem>>(cacheKey);
        if (cached != null)
            return Ok(cached);
        var query = _context
            .Tickets.Include(t => t.CreatedBy)
            .Include(t => t.CIJobs)
            .Include(t => t.DetectedByUser)
            .AsQueryable();

        if (includeDeleted)
        {
            // override global query filters so soft-deleted tickets are also visible
            query = query.IgnoreQueryFilters();
        }

        if (
            !string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<TicketStatus>(status, true, out var statusEnum)
        )
            query = query.Where(t => t.Status == statusEnum);

        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TicketListItem(
                t.Id,
                t.ExternalCode,
                t.Title,
                t.Status.ToString(),
                t.IsBlocking,
                t.CreatedAt,
                t.CreatedBy.DisplayName,
                t.CIJobs.Any(j => j.Status == CIJobStatus.Succeeded),
                t.IsActive,
                t.IsDeleted,
                t.DetectedDate,
                t.ResponseDate,
                t.DetectedByUser != null ? t.DetectedByUser.DisplayName : null,
                t.TtcomsCode,
                // NEW: last activity date
                t.Actions.OrderByDescending(a => a.PerformedAt)
                    .Select(a => (DateTime?)a.PerformedAt)
                    .FirstOrDefault()
                ?? (DateTime?)t.UpdatedAt
                    ?? (DateTime?)t.CreatedAt,
                // NEW: last activity item (action type, or "Oluşturma")
                t.Actions.OrderByDescending(a => a.PerformedAt)
                    .Select(a => a.ActionType.ToString())
                    .FirstOrDefault()
                ?? "Created"
            ))
            .ToListAsync();

        await _cache.SetAsync(cacheKey, items, TimeSpan.FromMinutes(15));

        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TicketDetail>> GetTicket(long id)
    {
        var cacheKey = $"tickets:detail:{id}";

        var cached = await _cache.GetAsync<TicketDetail>(cacheKey);
        if (cached != null)
        {
            return Ok(cached);
        }

        var isAdmin = User.IsInRole("Admin");
        IQueryable<Ticket> query = _context
            .Tickets.Include(t => t.CreatedBy)
            .Include(t => t.LastUpdatedBy)
            .Include(t => t.DetectedByUser)
                .ThenInclude(u => u.MilitaryRank)
            .Include(t => t.CI)
            .Include(t => t.Component)
            .Include(t => t.Subsystem)
            .Include(t => t.System)
            .Include(t => t.ResponseByUser)
                .ThenInclude(rp => rp.User)
                    .ThenInclude(u => u.MilitaryRank)
            .Include(t => t.ResponseResolvedByUser)
                .ThenInclude(rp => rp.User)
                    .ThenInclude(u => u.MilitaryRank)
            .Include(t => t.ActivityControlPersonnel)
                .ThenInclude(u => u.MilitaryRank)
            .Include(t => t.ActivityControlCommander)
                .ThenInclude(u => u.MilitaryRank)
            .Include(t => t.Actions)
                .ThenInclude(a => a.PerformedBy)
            .Include(t => t.Comments)
                .ThenInclude(c => c.CreatedBy);

        if (isAdmin)
        {
            query = query.IgnoreQueryFilters();
        }
        var ticket = await query.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket == null)
            return NotFound();

        if (!isAdmin && ticket.IsDeleted)
            return NotFound();

        var detail = new TicketDetail(
            ticket.Id,
            ticket.ExternalCode,
            ticket.Title,
            ticket.Description,
            ticket.IsBlocking,
            ticket.Status.ToString(),
            ticket.ConfirmationStatus?.ToString(),
            ticket.TechnicalReportRequired,
            ticket.CreatedAt,
            ticket.UpdatedAt,
            ticket.CreatedBy.DisplayName,
            ticket.CreatedById,
            ticket.LastUpdatedBy?.DisplayName,
            ticket.LastUpdatedById,
            ticket.IsActive,
            ticket.IsDeleted,
            ticket.CIId,
            ticket.ComponentId,
            ticket.SubsystemId,
            ticket.SystemId,
            ticket.CI?.Name,
            ticket.Component?.Name,
            ticket.Subsystem?.Name,
            ticket.System?.Name,
            // Detection fields
            ticket.DetectedDate,
            ticket.DetectedContractorNotifiedAt,
            ticket.DetectedNotificationMethods?.Select(m => m.ToString()).ToArray(),
            ticket.DetectedByUserId,
            ticket.DetectedByUser != null ? FormatUserName(ticket.DetectedByUser) : null,
            // Response fields
            ticket.ResponseDate,
            ticket.ResponseResolvedAt,
            ticket
                .ResponseByUser.Select(rp => new ResponsePersonnelItem(
                    rp.UserId,
                    FormatUserName(rp.User)
                ))
                .ToList(),
            ticket
                .ResponseResolvedByUser.Select(rp => new ResponseResolvedPersonnelItem(
                    rp.UserId,
                    FormatUserName(rp.User)
                ))
                .ToList(),
            ticket.ResponseActions,
            // Related data
            ticket.ActivityControlPersonnelId,
            ticket.ActivityControlCommanderId,
            ticket.ActivityControlDate,
            ticket.ActivityControlResult,
            ticket
                .Actions.OrderByDescending(a => a.PerformedAt)
                .Select(a => new TicketActionItem(
                    a.Id,
                    a.ActionType.ToString(),
                    a.FromStatus?.ToString(),
                    a.ToStatus?.ToString(),
                    a.Notes,
                    a.PerformedBy.DisplayName,
                    a.PerformedAt
                ))
                .ToList(),
            ticket
                .Comments.OrderByDescending(c => c.CreatedAt)
                .Select(c => new CommentItem(c.Id, c.Body, c.CreatedBy.DisplayName, c.CreatedAt))
                .ToList(),
            ticket.TtcomsCode,
            ticket.ItemDescription,
            ticket.ItemId,
            ticket.ItemSerialNo,
            ticket.ActivityControlPersonnel != null
                ? FormatUserName(ticket.ActivityControlPersonnel)
                : null,
            ticket.ActivityControlCommander != null
                ? FormatUserName(ticket.ActivityControlCommander)
                : null,
            ticket.NewItemDescription,
            ticket.NewItemId,
            ticket.NewItemSerialNo,
            ticket.HpNo,
            ticket.TentativeSolutionDate,
            (int?)ticket.ActivityControlStatus,
            ticket.SubContractor,
            ticket.SubContractorNotifiedAt
        );
        await _cache.SetAsync(cacheKey, detail, TimeSpan.FromDays(100));
        return Ok(detail);
    }

    [HttpPost]
    [Authorize(Roles = "Editor,Admin")]
    public async Task<ActionResult<TicketDetail>> CreateTicket(
        [FromBody] CreateTicketRequest request
    )
    {
        if (!Enum.TryParse<TicketStatus>(request.Status, true, out var status))
            return BadRequest(new { message = "Invalid status" });

        // Parse notification methods if provided
        NotificationMethod[]? notificationMethods = null;
        if (
            request.DetectedNotificationMethods != null
            && request.DetectedNotificationMethods.Length > 0
        )
        {
            var methods = new List<NotificationMethod>();
            foreach (var method in request.DetectedNotificationMethods)
            {
                if (Enum.TryParse<NotificationMethod>(method, true, out var nm))
                    methods.Add(nm);
            }
            notificationMethods = methods.ToArray();
        }

        var ticket = new Ticket
        {
            // ExternalCode = $"TKT-{DateTime.UtcNow:yyyy}-{Guid.NewGuid().ToString()[..8].ToUpper()}",
            ExternalCode = await GenerateNextExternalCodeAsync(),
            Title = request.Title,
            Description = request.Description,
            IsBlocking = request.IsBlocking,
            Status = status,
            TechnicalReportRequired = request.TechnicalReportRequired,

            // Hierarchy fields
            CIId = request.CIId,
            ComponentId = request.ComponentId,
            SubsystemId = request.SubsystemId,
            SystemId = request.SystemId,

            // Detection fields
            DetectedDate = request.DetectedDate,
            DetectedContractorNotifiedAt = request.DetectedContractorNotifiedAt,
            DetectedNotificationMethods = notificationMethods,
            DetectedByUserId = request.DetectedByUserId,

            // Response fields
            ResponseDate = request.ResponseDate,
            ResponseResolvedAt = request.ResponseResolvedAt,
            ResponseActions = request.ResponseActions,

            // Activity Control fields
            ActivityControlPersonnelId = request.ActivityControlPersonnelId,
            ActivityControlCommanderId = request.ActivityControlCommanderId,
            ActivityControlDate = request.ActivityControlDate,
            ActivityControlResult = request.ActivityControlResult,
            ActivityControlStatus = request.ActivityControlStatus.HasValue
                ? (ControlStatus)request.ActivityControlStatus.Value
                : null,

            TtcomsCode = request.TtcomsCode,
            ItemDescription = request.ItemDescription,
            ItemId = request.ItemId,
            ItemSerialNo = request.ItemSerialNo,
            NewItemDescription = request.NewItemDescription,
            NewItemId = request.NewItemId,
            NewItemSerialNo = request.NewItemSerialNo,
            HpNo = request.HpNo,
            TentativeSolutionDate = request.TentativeSolutionDate,
            SubContractor = request.SubContractor,
            SubContractorNotifiedAt = request.SubContractorNotifiedAt,

            IsActive = true,
            IsDeleted = false,
        };

        var created = await _ticketService.CreateTicketAync(ticket, GetCurrentUserId());

        // Add response personnel if provided
        if (request.ResponsePersonnelIds != null && request.ResponsePersonnelIds.Any())
        {
            foreach (var userId in request.ResponsePersonnelIds)
            {
                _context.TicketResponsePersonnel.Add(
                    new TicketResponsePersonnel { TicketId = created.Id, UserId = userId }
                );
            }
            await _context.SaveChangesAsync();
        }

        // Add response personnel if provided
        if (
            request.ResponseResolvedPersonnelIds != null
            && request.ResponseResolvedPersonnelIds.Any()
        )
        {
            foreach (var userId in request.ResponseResolvedPersonnelIds)
            {
                _context.TicketResponseResolvedPersonnel.Add(
                    new TicketResponseResolvedPersonnel { TicketId = created.Id, UserId = userId }
                );
            }
            await _context.SaveChangesAsync();
        }

        var notificationService =
            HttpContext.RequestServices.GetRequiredService<NotificationService>();
        await notificationService.CreateNewTicketNotification(ticket, GetCurrentUserId());

        // invalidate the cache
        await InvalidateTicketListCacheAsync();
        return CreatedAtAction(
            nameof(GetTicket),
            new { id = created.Id },
            await GetTicket(created.Id)
        );
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Editor,Admin")]
    public async Task<ActionResult> UpdateTicket(long id, [FromBody] UpdateTicketRequest request)
    {
        var ticket = await _context
            .Tickets.Include(t => t.ResponseByUser)
            .Include(t => t.ResponseResolvedByUser)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket == null)
            return NotFound();

        var currentUserId = GetCurrentUserId();
        var hasChanges = false;

        // Update basic fields
        if (request.Title != null && ticket.Title != request.Title)
        {
            ticket.Title = request.Title;
            hasChanges = true;
        }

        if (request.TtcomsCode != null && ticket.TtcomsCode != request.TtcomsCode)
        {
            ticket.TtcomsCode = request.TtcomsCode;
            hasChanges = true;
        }

        if (request.Description != null && ticket.Description != request.Description)
        {
            ticket.Description = request.Description;
            hasChanges = true;
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (Enum.TryParse<TicketStatus>(request.Status, true, out var newStatus))
            {
                if (ticket.Status != newStatus)
                {
                    var oldStatus = ticket.Status;
                    ticket.Status = newStatus;
                    hasChanges = true;

                    // Log the status change in the action
                    _context.TicketActions.Add(
                        new TicketAction
                        {
                            TicketId = id,
                            ActionType = ActionType.StatusChange,
                            FromStatus = oldStatus,
                            ToStatus = newStatus,
                            Notes = $"Status changed from {oldStatus} to {newStatus}",
                            PerformedById = currentUserId,
                            PerformedAt = DateTime.UtcNow,
                        }
                    );
                }
            }
        }

        if (request.IsBlocking.HasValue && ticket.IsBlocking != request.IsBlocking.Value)
        {
            ticket.IsBlocking = request.IsBlocking.Value;
            hasChanges = true;
        }

        if (
            request.TechnicalReportRequired.HasValue
            && ticket.TechnicalReportRequired != request.TechnicalReportRequired.Value
        )
        {
            ticket.TechnicalReportRequired = request.TechnicalReportRequired.Value;
            hasChanges = true;
        }

        // Update reference IDs
        if (request.CIId.HasValue)
            ticket.CIId = request.CIId;
        if (request.ComponentId.HasValue)
            ticket.ComponentId = request.ComponentId;
        if (request.SubsystemId.HasValue)
            ticket.SubsystemId = request.SubsystemId;
        if (request.SystemId.HasValue)
            ticket.SystemId = request.SystemId;

        // Update detection fields
        if (request.DetectedDate.HasValue)
            ticket.DetectedDate = request.DetectedDate;
        if (request.DetectedContractorNotifiedAt.HasValue)
            ticket.DetectedContractorNotifiedAt = request.DetectedContractorNotifiedAt;
        if (request.DetectedByUserId.HasValue)
            ticket.DetectedByUserId = request.DetectedByUserId;

        if (request.DetectedNotificationMethods != null)
        {
            var methods = new List<NotificationMethod>();
            foreach (var method in request.DetectedNotificationMethods)
            {
                if (Enum.TryParse<NotificationMethod>(method, true, out var nm))
                    methods.Add(nm);
            }
            ticket.DetectedNotificationMethods = methods.ToArray();
            hasChanges = true;
        }

        // Update response fields
        if (request.ResponseDate.HasValue)
            ticket.ResponseDate = request.ResponseDate;
        if (request.ResponseResolvedAt.HasValue)
            ticket.ResponseResolvedAt = request.ResponseResolvedAt;

        if (request.ResponseActions != null && ticket.ResponseActions != request.ResponseActions)
        {
            ticket.ResponseActions = request.ResponseActions;
            hasChanges = true;
        }

        if (request.ItemDescription != null && ticket.ItemDescription != request.ItemDescription)
        {
            ticket.ItemDescription = request.ItemDescription;
            hasChanges = true;
        }

        if (request.ItemId != null && ticket.ItemId != request.ItemId)
        {
            ticket.ItemId = request.ItemId;
            hasChanges = true;
        }
        if (request.ItemSerialNo != null && ticket.ItemSerialNo != request.ItemSerialNo)
        {
            ticket.ItemSerialNo = request.ItemSerialNo;
            hasChanges = true;
        }

        if (request.SubContractor != null && ticket.SubContractor != request.SubContractor)
        {
            ticket.SubContractor = request.SubContractor;
            hasChanges = true;
        }
        if (
            request.SubContractorNotifiedAt != null
            && ticket.SubContractorNotifiedAt != request.SubContractorNotifiedAt
        )
        {
            ticket.SubContractorNotifiedAt = request.SubContractorNotifiedAt;
            hasChanges = true;
        }

        // New and/or replaced Item Description

        if (
            request.NewItemDescription != null
            && ticket.NewItemDescription != request.NewItemDescription
        )
        {
            ticket.NewItemDescription = request.NewItemDescription;
            hasChanges = true;
        }

        if (request.NewItemId != null && ticket.NewItemId != request.NewItemId)
        {
            ticket.NewItemId = request.NewItemId;
            hasChanges = true;
        }
        if (request.NewItemSerialNo != null && ticket.NewItemSerialNo != request.NewItemSerialNo)
        {
            ticket.NewItemSerialNo = request.NewItemSerialNo;
            hasChanges = true;
        }

        if (request.HpNo != null && ticket.HpNo != request.HpNo)
        {
            ticket.HpNo = request.HpNo;
            hasChanges = true;
        }

        if (request.TentativeSolutionDate.HasValue)
            ticket.TentativeSolutionDate = request.TentativeSolutionDate;

        // Update response personnel if provided
        if (request.ResponsePersonnelIds != null)
        {
            // Remove existing personnel
            _context.TicketResponsePersonnel.RemoveRange(ticket.ResponseByUser);

            // Add new personnel
            foreach (var userId in request.ResponsePersonnelIds)
            {
                _context.TicketResponsePersonnel.Add(
                    new TicketResponsePersonnel { TicketId = ticket.Id, UserId = userId }
                );
            }
            hasChanges = true;
        }

        // Update response personnel if provided
        if (request.ResponseResolvedPersonnelIds != null)
        {
            // Remove existing personnel
            _context.TicketResponseResolvedPersonnel.RemoveRange(ticket.ResponseResolvedByUser);

            // Add new personnel
            foreach (var userId in request.ResponseResolvedPersonnelIds)
            {
                _context.TicketResponseResolvedPersonnel.Add(
                    new TicketResponseResolvedPersonnel { TicketId = ticket.Id, UserId = userId }
                );
            }
            hasChanges = true;
        }

        if (request.ActivityControlPersonnelId.HasValue)
        {
            ticket.ActivityControlPersonnelId = request.ActivityControlPersonnelId;
            hasChanges = true;
        }

        if (request.ActivityControlCommanderId.HasValue)
        {
            ticket.ActivityControlCommanderId = request.ActivityControlCommanderId;
            hasChanges = true;
        }

        if (request.ActivityControlDate.HasValue)
        {
            ticket.ActivityControlDate = request.ActivityControlDate;
            hasChanges = true;
        }

        if (
            request.ActivityControlResult != null
            && ticket.ActivityControlResult != request.ActivityControlResult
        )
        {
            ticket.ActivityControlResult = request.ActivityControlResult;
            hasChanges = true;
        }

        if (request.ActivityControlStatus.HasValue)
        {
            ticket.ActivityControlStatus = (ControlStatus)request.ActivityControlStatus.Value;
        }
        else
        {
            ticket.ActivityControlStatus = null;
        }

        if (hasChanges)
        {
            ticket.UpdatedAt = DateTime.UtcNow;
            ticket.LastUpdatedById = currentUserId;

            _context.TicketActions.Add(
                new TicketAction
                {
                    TicketId = id,
                    ActionType = ActionType.Edit,
                    Notes = "Sorun guncellendi",
                    PerformedById = currentUserId,
                    PerformedAt = DateTime.UtcNow,
                }
            );

            await _context.SaveChangesAsync();
        }
        await InvalidateTicketDetailCacheAsync(id);

        return NoContent();
    }

    [HttpPost("{id}/status")]
    [Authorize(Roles = "Editor,Admin")]
    public async Task<ActionResult> ChangeStatus(long id, [FromBody] ChangeStatusRequest request)
    {
        if (!Enum.TryParse<TicketStatus>(request.ToStatus, true, out var toStatus))
            return BadRequest(new { message = "Invalid status" });

        var ticket = await _context.Tickets.FindAsync(id);

        if (ticket == null)
            return NotFound(new { message = "Ticket not found" });

        var oldStatus = ticket.Status;
        var userId = GetCurrentUserId();

        // Handle pausing - create pause record
        if (toStatus == TicketStatus.PAUSED && oldStatus != TicketStatus.PAUSED)
        {
            if (string.IsNullOrWhiteSpace(request.PauseReason))
                return BadRequest(new { message = "Duraklama sebebi zorunludur" });

            var pause = new TicketPause
            {
                TicketId = id,
                PausedByUserId = userId,
                PauseReason = request.PauseReason,
                PausedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
            };

            _context.TicketPauses.Add(pause);
        }

        // Handle resuming - close active pause
        if (oldStatus == TicketStatus.PAUSED && toStatus != TicketStatus.PAUSED)
        {
            var activePause = await _context
                .TicketPauses.Where(tp => tp.TicketId == id && tp.ResumedAt == null)
                .OrderByDescending(tp => tp.PausedAt)
                .FirstOrDefaultAsync();

            if (activePause != null)
            {
                activePause.ResumedAt = DateTime.UtcNow;
                activePause.ResumedByUserId = userId;
            }
        }

        // Update ticket status
        ticket.Status = toStatus;

        ticket.UpdatedAt = DateTime.UtcNow;
        ticket.LastUpdatedById = userId;

        // Log the status change action
        var action = new TicketAction
        {
            TicketId = id,
            ActionType = ActionType.StatusChange,
            FromStatus = oldStatus,
            ToStatus = toStatus,
            Notes =
                toStatus == TicketStatus.PAUSED ? $"Sebep: {request.PauseReason}" : request.Notes,
            PerformedById = userId,
            PerformedAt = DateTime.UtcNow,
        };

        _context.TicketActions.Add(action);
        await InvalidateTicketListCacheAsync();
        await InvalidateTicketDetailCacheAsync(id);
        _logger.LogInformation(
            $"Attempting to change status for ticket {id} from {oldStatus} to {toStatus} by user {userId}"
        );

        try
        {
            await _context.SaveChangesAsync();

            // Invalidate cache (safely handle if cache is null)
            try
            {
                if (_cache != null)
                {
                    await _cache.RemoveAsync($"tickets:detail:{id}");
                    await _cache.RemoveByPatternAsync("tickets:list:*");
                    await _cache.RemoveByPatternAsync($"pause:ticket:{id}");
                }
            }
            catch (Exception cacheEx)
            {
                _logger.LogWarning(
                    cacheEx,
                    $"Failed to invalidate cache for ticket {id}, but operation succeeded"
                );
            }

            _logger.LogInformation(
                $"Status changed for ticket {id}: {oldStatus} -> {toStatus} by user {userId}"
            );

            return Ok(new { message = $"Durum değiştirildi: {toStatus}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error changing status for ticket {id}");
            return BadRequest(new { message = $"Durum değiştirilemedi: {ex.Message}" });
        }
    }

    [HttpPost("{id}/comments")]
    [Authorize(Roles = "Editor,Admin")]
    public async Task<ActionResult> AddComment(long id, [FromBody] AddCommentRequest request)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null)
            return NotFound();

        var comment = new TicketComment
        {
            TicketId = id,
            Body = request.Body,
            CreatedById = GetCurrentUserId(),
            CreatedAt = DateTime.UtcNow,
        };

        _context.TicketComments.Add(comment);
        _context.TicketActions.Add(
            new TicketAction
            {
                TicketId = id,
                ActionType = ActionType.Comment,
                Notes = "Yeni bir islem eklendi",
                PerformedById = GetCurrentUserId(),
                PerformedAt = DateTime.UtcNow,
            }
        );

        ticket.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await InvalidateTicketListCacheAsync();
        await InvalidateTicketDetailCacheAsync(id);

        return Ok(new { id = comment.Id });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Editor, Admin")]
    public async Task<ActionResult> DeleteTicket(long id)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null)
            return NotFound();

        // soft delete could be implemented here instead
        ticket.IsDeleted = true;
        ticket.IsActive = false;
        ticket.UpdatedAt = DateTime.UtcNow;
        ticket.LastUpdatedById = GetCurrentUserId();

        _context.TicketActions.Add(
            new TicketAction
            {
                TicketId = id,
                ActionType = ActionType.Edit,
                Notes = "Ticket deleted (soft delete)",
                PerformedById = GetCurrentUserId(),
                PerformedAt = DateTime.UtcNow,
            }
        );
        await _context.SaveChangesAsync();
        // await InvalidateTicketListCacheAsync();
        await InvalidateTicketCacheAsync(id);

        return NoContent();
    }

    // Helper endpoint to get available users for response personnel dropdown
    [HttpGet("available-personnel")]
    public async Task<ActionResult<List<PersonnelOption>>> GetAvailablePersonnel()
    {
        const string cacheKey = "tickets:dropdown:available-personnel";

        var cached = await _cache.GetAsync<List<PersonnelOption>>(cacheKey);
        if (cached != null)
            return Ok(cached);

        var users = await _context
            .Users.Where(u => u.IsActive)
            .OrderBy(u => u.DisplayName)
            .Select(u => new
            {
                u.Id,
                u.DisplayName,
                u.Department,
                RankCode = u.MilitaryRank != null ? u.MilitaryRank.DisplayName : null,
                Role = u.Role.ToString(),
            })
            .ToListAsync();

        // Step 2: Map to PersonnelOption in memory
        var personnelOptions = users
            .Select(u => new PersonnelOption(u.Id, u.DisplayName, u.Department, u.RankCode, u.Role))
            .ToList();

        await _cache.SetAsync(cacheKey, personnelOptions, TimeSpan.FromMinutes(30));

        return Ok(personnelOptions);
    }

    public record PersonnelOption(
        long Id,
        string DisplayName,
        string? Department,
        string? RankCode,
        string Role
    );

    private async Task<string> GenerateNextExternalCodeAsync()
    {
        var now = DateTime.UtcNow;
        var year = now.Year;
        var month = now.Month;

        // Pattern to match: AKF-YYYY-MM-
        var monthPrefix = $"AKF-{year:D4}-{month:D2}-";

        // Find the last ticket created in this year-month
        var lastTicket = await _context
            .Tickets.IgnoreQueryFilters()
            .Where(t => t.ExternalCode.StartsWith(monthPrefix))
            .OrderByDescending(t => t.Id)
            .Select(t => t.ExternalCode)
            .FirstOrDefaultAsync();

        int nextNumber = 1;

        if (lastTicket != null)
        {
            // Extract the serial number from the last ticket
            // Format: AKF-2024-04-5 -> extract "5"
            var parts = lastTicket.Split('-');
            if (parts.Length == 4 && int.TryParse(parts[3], out int lastNumber))
            {
                nextNumber = lastNumber + 1;
            }
        }

        return $"{monthPrefix}{nextNumber}";
    }

    private string FormatUserName(User user)
    {
        if (user == null)
            return string.Empty;

        // If military rank exists: "Rank Name Surname"
        if (user.MilitaryRank != null && !string.IsNullOrWhiteSpace(user.MilitaryRank.DisplayName))
        {
            return $"{user.MilitaryRank.DisplayName} {user.DisplayName}";
        }

        // If non-military but has department: "Department Name Surname"
        if (!string.IsNullOrWhiteSpace(user.Department))
        {
            return $"{user.Department} {user.DisplayName}";
        }

        // Otherwise just: "Name Surname"
        return user.DisplayName;
    }

    [HttpGet("export/excel")]
    [Authorize(Roles = "Editor,Admin")]
    public async Task<IActionResult> ExportToExcel()
    {
        try
        {
            var tickets = await _context
                .Tickets.Include(t => t.CreatedBy)
                .Include(t => t.LastUpdatedBy)
                .Include(t => t.DetectedByUser)
                    .ThenInclude(u => u.MilitaryRank)
                .Include(t => t.CI)
                .Include(t => t.Component)
                .Include(t => t.Subsystem)
                .Include(t => t.System)
                .Include(t => t.ResponseByUser)
                    .ThenInclude(rp => rp.User)
                        .ThenInclude(u => u.MilitaryRank)
                .Include(t => t.ResponseResolvedByUser)
                    .ThenInclude(rp => rp.User)
                        .ThenInclude(u => u.MilitaryRank)
                .Include(t => t.ActivityControlPersonnel)
                    .ThenInclude(u => u.MilitaryRank)
                .Include(t => t.Actions)
                .Include(t => t.ActivityControlCommander)
                    .ThenInclude(u => u.MilitaryRank)
                .Where(t => t.IsActive && !t.IsDeleted)
                .OrderByDescending(t => t.CreatedAt)
                // .OrderBy(t => t.CreatedAt)
                .ToListAsync();

            var excelData = await _excelExportService.GenerateTicketsExcelAsync(tickets);

            var fileName = $"Ariza_Kayitlari_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

            return File(
                excelData,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName
            );
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Excel export failed", error = ex.Message });
        }
    }

    [HttpPost("{id}/restore")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> RestoreTicket(long id)
    {
        // Need IgnoreQueryFilters to see soft-deleted tickets
        var ticket = await _context
            .Tickets.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket == null)
            return NotFound();

        if (!ticket.IsDeleted)
            return BadRequest(new { message = "Ticket is not deleted." });

        var currentUserId = GetCurrentUserId();

        ticket.IsDeleted = false;
        ticket.IsActive = true;
        ticket.UpdatedAt = DateTime.UtcNow;
        ticket.LastUpdatedById = currentUserId;

        _context.TicketActions.Add(
            new TicketAction
            {
                TicketId = id,
                ActionType = ActionType.Edit,
                Notes = "Ticket restored (undelete)",
                PerformedById = currentUserId,
                PerformedAt = DateTime.UtcNow,
            }
        );

        await _context.SaveChangesAsync();

        return NoContent();
    }

    //Helper functions for cache invalidation
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
