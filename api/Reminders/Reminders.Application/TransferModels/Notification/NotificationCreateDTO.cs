using Reminders.Domain.Enums;

namespace Reminders.Application.TransferModels.Notification;

public class NotificationCreateDTO
{
    public Guid ReminderId { get; set; }
    
    public DateTime NotificationTime { get; set; }
    
    public RecurrencyTypes Recurrency { get; set; }
}