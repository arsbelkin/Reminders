using Reminders.Domain.Enums;

namespace Reminders.Application.TransferModels.Reminder;

public class ReminderRequestDTO
{
    public Guid CategoryId { get; set; }
    
    public string Title { get; set; }
    
    public string? Description { get; set; }
    
    public PriorityTypes Priority { get; set; }
    
    public DateTime? DueDate { get; set; }

    public List<string> UsersEmails { get; set; } = new List<string>();
}