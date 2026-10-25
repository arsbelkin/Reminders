using Reminders.Domain.Enums;

namespace Reminders.Application.TransferModels.Reminder;

public class ReminderSearchDTO
{
    public int? Page { get; set; }
    
    public int? PageSize { get; set; }
    
    public string? SearchText { get; set; }

    public List<Guid> CategoryIds { get; set; } = new List<Guid>();

    public List<PriorityTypes> PriorityTypes { get; set; } = new List<PriorityTypes>();
    
    public DateTime? FromDate { get; set; }
    
    public DateTime? ToDate { get; set; }
    
    public CompletedStatusTypes? CompletedStatus { get; set; }
}