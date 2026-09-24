namespace Api.DTOs
{
    public record TicketPauseListItem(
        long Id,
        long TicketId,
        string TicketExternalCode,
        DateTime PausedAt,
        DateTime? ResumedAt,
        string PauseReason,
        string? ResumeNotes,
        string PausedByUserName,
        string? ResumedByUserName,
        bool IsActive,
        int DurationHours
    );

    public record TicketPauseDetail(
        long Id,
        long TicketId,
        string TicketExternalCode,
        string TicketTitle,
        DateTime PausedAt,
        DateTime? ResumedAt,
        string PauseReason,
        string? ResumeNotes,
        long PausedByUserId,
        string PausedByUserName,
        long? ResumedByUserId,
        string? ResumedByUserName,
        DateTime CreatedAt
    );

    public record CreateTicketPauseRequest(
        long TicketId,
        string PauseReason
    );

    public record ResumeTicketPauseRequest(
        long PauseId,
        string? ResumeNotes,
        DateTime? ResumedAt = null
    );

    public record UpdateTicketPauseRequest(
        string PauseReason,
        string? ResumeNotes
    );
}