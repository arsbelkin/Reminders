using Reminders.Domain.Enums;

namespace Reminders.Application.TransferModels.Reminder;

public class ReminderListViewDTO
{
    public Guid Id { get; set; }
    
    public Guid CategoryId { get; set; }
    
    public string CategoryName { get; set; }
    
    public string Title { get; set; }
    
    public PriorityTypes Priority { get; set; }
    
    public CompletedStatusTypes IsCompleted { get; set; }
}