using Reminders.Domain.Enums;

namespace Reminders.Domain.Models;

public class Notification
{
    public Guid Id { get; set; }
    
    public Guid ReminderId { get; set; }
    
    public Guid ReceiverId { get; set; }

    public ProcessedStatusTypes IsProcessed { get; set; }
    
    public DateTime NotificationTime { get; set; }
    
    public RecurrencyTypes Recurrency { get; set; }
    
    public User Receiver { get; set; }
    
    public Reminder Reminder { get; set; }
    
    public void UpdateNotificationTime()
    {
        switch (Recurrency)
        {
            case RecurrencyTypes.Daily:
                NotificationTime = NotificationTime.AddDays(1);
                break;
            case RecurrencyTypes.Monthly:
                NotificationTime = NotificationTime.AddMonths(1);
                break;
            case RecurrencyTypes.Weekly:
                NotificationTime = NotificationTime.AddDays(7);
                break;
            case RecurrencyTypes.Yearly:
                NotificationTime = NotificationTime.AddYears(1);
                break;
            default:
                break;
        }
    }
}