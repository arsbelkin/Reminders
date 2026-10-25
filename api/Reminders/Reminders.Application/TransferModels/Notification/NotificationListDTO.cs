using Reminders.Domain.Enums;

namespace Reminders.Application.TransferModels.Notification;

public class NotificationListDTO
{
    public Guid Id { get; set; }
    
    public Guid CategoryId { get; set; }
    
    public string CategoryTitle { get; set; }
    
    public Guid ReminderId { get; set; }
    
    public string ReminderTitle { get; set; }
    
    public string? ReminderDescription { get; set; }
    
    public DateTime NotificationTime { get; set; }
    
    public RecurrencyTypes Recurrency { get; set; }
}