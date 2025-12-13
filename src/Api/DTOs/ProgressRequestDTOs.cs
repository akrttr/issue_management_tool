namespace Api.DTOs
{
    public record ProgressRequestListItem(
        long Id,
        long TicketId,
        string TicketCode,
        string TicketTitle,
        long RequestedByUserId,
        string RequestedByName,
        long TargetUserId,
        string TargetUserName,
        string? RequestMessage,
        DateTime RequestedAt,
        DateTime? DueDate,
        string? ProgressInfo,
        bool IsResponded,
        DateTime? RespondedAt,
        string? RespondedByName,
        string Status,
        bool IsOverdue,
        int? ProgressPercentage,
        DateTime? EstimatedCompletion,
        int UpdateCount,
        List<ProgressRequestUpdateItem> Updates
    );

    public record ProgressRequestDetail(
        long Id,
        long TicketId,
        string TicketCode,
        string TicketTitle,
        long RequestedByUserId,
        string RequestedByName,
        long TargetUserId,
        string TargetUserName,
        string? RequestMessage,
        DateTime RequestedAt,
        DateTime? DueDate,
        string? ProgressInfo,
        bool IsResponded,
        DateTime? RespondedAt,
        long? RespondedByUserId,
        string? RespondedByName,
        long? ResponseActionId,
        string? ResponseText,
        string Status,
        long? NotificationId,
        int? ProgressPercentage,
        DateTime? EstimatedCompletion,
        List<ProgressRequestUpdateItem> Updates
    );

    public record CreateProgressRequestRequest(
        long TicketId,
        long TargetUserId,
        string? RequestMessage,
        DateTime? DueDate
    );

    public record UpdateProgressRequest(
        string ProgressInfo,
        int? ProgressPercentage,
        DateTime? EstimatedCompletion
    );

    public record RespondToProgressRequest(string ResponseNotes);

    public record ProgressRequestUpdateItem(
        long Id,
        long ProgressRequestId,
        long UpdatedByUserId,
        string UpdatedByName,
        string? ProgressInfo,
        int? ProgressPercentage,
        DateTime? EstimatedCompletion,
        DateTime UpdatedAt
    );
}
