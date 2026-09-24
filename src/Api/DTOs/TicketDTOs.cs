using System.Reflection.PortableExecutable;

namespace Api.DTOs;

// Create a new ticket
public record CreateTicketRequest(
    string Title,
    string Description,
    bool IsBlocking,
    string Status,
    bool TechnicalReportRequired,
    long? CIId,
    long? ComponentId,
    long? SubsystemId,
    long? SystemId,
    // Detection fields
    DateTime? DetectedDate,
    DateTime? DetectedContractorNotifiedAt,
    string[]? DetectedNotificationMethods,
    long? DetectedByUserId,
    // Response fields
    DateTime? ResponseDate,
    DateTime? ResponseResolvedAt,
    List<long>? ResponsePersonnelIds,
    List<long>? ResponseResolvedPersonnelIds,
    string? ResponseActions,
    // Activity control fields
    long? ActivityControlPersonnelId,
    long? ActivityControlCommanderId,
    DateTime? ActivityControlDate,
    string? ActivityControlResult,
    string? TtcomsCode,
    string? ItemDescription,
    string? ItemId,
    string? ItemSerialNo,
    string? NewItemDescription,
    string? NewItemId,
    string? NewItemSerialNo,
    string? HpNo,
    DateTime? TentativeSolutionDate,
    int? ActivityControlStatus,
    string? SubContractor,
    DateTime? SubContractorNotifiedAt
);

// Change Status of the ticket
public record ChangeStatusRequest(string ToStatus, string? Notes, string? PauseReason, DateTime? PausedAt = null);

// Add comment and/or progress
public record AddCommentRequest(string Body);

// List the available tickets in the system
public record TicketListItem(
    long Id,
    string ExternalCode,
    string Title,
    string Status,
    bool IsBlocking,
    DateTime CreatedAt,
    string CreatedByName,
    bool HasSuccessfulCIJob,
    bool IsActive,
    bool IsDeleted,
    DateTime? DetectDate,
    DateTime? ResponseDate,
    string? DetectedByUserName,
    string? TtcomsCode,
    DateTime? LastActivityDate,
    string? LastActivityItem
);

public record RecentActivityItem(
    long ActionId,
    long TicketId,
    string TicketExternalCode,
    string TicketTitle,
    string ActionType,
    string? FromStatus,
    string? ToStatus,
    string? Notes,
    string PerformedByName,
    string? PerformedByRank,
    DateTime PerformedAt
);

// Get the associated ticket detail
public record TicketDetail(
    long Id,
    string ExternalCode,
    string Title,
    string Description,
    bool IsBlocking,
    string Status,
    string? ConfirmationStatus,
    bool TechnicalReportRequired,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string CreatedByName,
    long CreatedById,
    string? LastUpdatedByName,
    long? LastUpdatedById,
    bool IsActive,
    bool IsDeleted,
    long? CIId,
    long? ComponentId,
    long? SubsystemId,
    long? SystemId,
    string? CIName,
    string? ComponentName,
    string? SubsystemName,
    string? SystemName,
    // Detection fields
    DateTime? DetectedDate,
    DateTime? DetectedContractorNotifiedAt,
    string[]? DetectedNotificationMethods,
    long? DetectedByUserId,
    string? DetectedByUserName,
    // Response fields
    DateTime? ResponseDate,
    DateTime? ResponseResolvedAt,
    List<ResponsePersonnelItem> ResponsePersonnel,
    List<ResponseResolvedPersonnelItem> ResponseResolvedPersonnel,
    string? ResponseActions,
    // Activity control fields
    long? ActivityControlPersonnelId,
    long? ActivityControlCommanderId,
    DateTime? ActivityControlDate,
    string? ActivityControlResult,
    // Related data
    List<TicketActionItem> Actions,
    List<CommentItem> Comments,
    string? TtcomsCode,
    string? ItemDescription,
    string? ItemId,
    string? ItemSerialNo,
    string? ActivityControlPersonnelName,
    string? ActivityControlCommanderName,
    string? NewItemDescription,
    string? NewItemId,
    string? NewItemSerialNo,
    string? HpNo,
    DateTime? TentativeSolutionDate,
    int? ActivityControlStatus,
    string? SubContractor,
    DateTime? SubContractorNotifiedAt
);

// Response personnel item
public record ResponsePersonnelItem(long UserId, string DisplayName);

public record ResponseResolvedPersonnelItem(long UserId, string DisplayName);

// Update the action taken on the selected ticket
public record TicketActionItem(
    long Id,
    string ActionType,
    string? FromStatus,
    string? ToStatus,
    string? Notes,
    string PerformedByName,
    DateTime PerformedAt
);

// Progress/Comment item
public record CommentItem(long Id, string Body, string CreatedByName, DateTime CreatedAt);

// Get Dashboard result
public record DashboardResponse(
    Dictionary<string, int> StatusCounts,
    List<TicketListItem> OngoingTickets
);

// Update ticket request
public record UpdateTicketRequest(
    string? Title,
    string? Description,
    bool? IsBlocking,
    bool? TechnicalReportRequired,
    long? CIId,
    long? ComponentId,
    long? SubsystemId,
    long? SystemId,
    // Detection fields
    DateTime? DetectedDate,
    DateTime? DetectedContractorNotifiedAt,
    string[]? DetectedNotificationMethods,
    long? DetectedByUserId,
    // Response fields
    DateTime? ResponseDate,
    DateTime? ResponseResolvedAt,
    List<long>? ResponsePersonnelIds,
    List<long>? ResponseResolvedPersonnelIds,
    string? ResponseActions,
    // Activity control fields
    long? ActivityControlPersonnelId,
    long? ActivityControlCommanderId,
    DateTime? ActivityControlDate,
    string? ActivityControlResult,
    string? Status,
    string? TtcomsCode,
    string? ItemDescription,
    string? ItemId,
    string? ItemSerialNo,
    string? NewItemDescription,
    string? NewItemId,
    string? NewItemSerialNo,
    string? HpNo,
    DateTime? TentativeSolutionDate,
    int? ActivityControlStatus,
    string? SubContractor,
    DateTime? SubContractorNotifiedAt
);

public record SystemOption(long Id, string? Name);

public record SubsystemOption(long Id, string Name, long? SystemId);

public record CIOption(long Id, string Name);

public record ComponentOption(long Id, string Name, long? SubsystemId);
