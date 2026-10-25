using Reminders.Domain.Enums;

namespace Reminders.Application.TransferModels.Reminder;

public class ReminderInfoViewDTO
{
    public Guid Id { get; set; }
    
    public Guid CreatorId { get; set; }
    
    public Guid CategoryId { get; set; }
    
    public string CategoryName { get; set; }
    
    public string Title { get; set; }
    
    public string? Description { get; set; }
    
    public DateTime CreatedTime { get; set; }
    
    public PriorityTypes Priority { get; set; }
    
    public CompletedStatusTypes IsCompleted { get; set; }
    
    public DateTime? CompletedTime { get; set; }
    
    public DateTime? DueDate { get; set; }

    public List<string> MemberEmails { get; set; } = new List<string>();
}