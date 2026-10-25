using Reminders.Application.Enums;

namespace Reminders.Application.TransferModels.Notification;

public class NotificationWrapper
{
    public MessageTypes MessageType { get; set; }
    
    public Guid NotificationId { get; set; }
    
    public NotificationMessageDTO? NotificationMessage { get; set; }
}