using Reminders.Application.TransferModels.Notification;
using Reminders.Domain.Models;
using Reminders.Domain.Enums;

namespace Reminders.Application.Repositories.Interfaces;

public interface INotificationRepository
{
    public Task CreateNotificationAsync(Notification notification);

    public Task<List<Notification>> GetComingNotificationsAsync();

    public Task UpdateNotificationsListAsync(List<Notification> notifications);

    public Task SetNotProcessedNotificationsByListIdAsync(List<Guid> notificationIds);

    public Task<List<NotificationListDTO>> GetUserNotificationsAsync(Guid userId);

    public Task<Notification?> GetNotificationAsync(Guid notificationId, Guid userId);

    public Task DeleteNotificationAsync(Notification notification);

    public Task<List<Notification>> GetNotificationsByReminderAsync(Guid reminderId,
        ProcessedStatusTypes status);
    
    public Task DeleteNotificationByReminderIdAsync(Guid reminderId);
    
    public Task<List<Notification>> GetNotificationsByCategoryAsync(Guid categoryId,
        ProcessedStatusTypes status);
    
    public Task DeleteNotificationByCategoryIdAsync(Guid categoryId);
    
    public Task UpdateNotificationAsync(Notification notification);

    public Task<bool> CanSendNotificationAsync(Guid notificationId);
}