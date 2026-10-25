namespace Reminders.Application.TransferModels.Notification;

public class NotificationMessageDTO
{
    public Guid NotificationId { get; set; }
    
    public string ReceiverEmail { get; set; }
    
    public string ReceiverUsername { get; set; }
    
    public string CategoryTitle { get; set; }
    
    public string ReminderTitle { get; set; }
    
    public string? ReminderDescription { get; set; }
    
    public DateTime NotificationTime { get; set; }
}