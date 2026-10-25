using Reminders.Domain.Enums;

namespace Reminders.Application.TransferModels.Reminder;

public class ReminderUpdateDTO
{
    public Guid CategoryId { get; set; }
    
    public string Title { get; set; }
    
    public string? Description { get; set; }
    
    public PriorityTypes Priority { get; set; }
    
    public DateTime? DueDate { get; set; }
}