using Reminders.Domain.Enums;

namespace Reminders.Application.TransferModels.Notification;

public class NotificationUpdateDTO
{
    public DateTime NotificationTime { get; set; }
    
    public RecurrencyTypes Recurrency { get; set; }
}