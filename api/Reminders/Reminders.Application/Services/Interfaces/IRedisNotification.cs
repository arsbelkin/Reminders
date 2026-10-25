using Reminders.Application.TransferModels.Notification;
using Reminders.Domain.Models;

namespace Reminders.Application.Services.Interfaces;

public interface IRedisNotification
{
    public Task ProcessMessageAsync(NotificationWrapper message);
    public Task AddToQueueAsync(NotificationWrapper message);
    public Task UpdateAsync(NotificationWrapper message);
    public Task DeleteFromQueueAsync(NotificationWrapper message);
    
    public Task<List<NotificationMessageDTO>> GetReadyNotificationsAsync(long maxUnixSeconds);
    
    public Task UpdateNotificationsListAsync(List<Notification> notifications);
}