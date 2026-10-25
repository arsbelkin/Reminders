using Reminders.Application.TransferModels.Notification;

namespace Reminders.Application.Services.Interfaces;

public interface INotificationService
{
    public Task<Guid> CreateNotificationAsync(NotificationCreateDTO dto, Guid userId);
    public Task<List<NotificationListDTO>> GetUserNotificationsAsync(Guid userId);
    public Task DeleteNotificationAsync(Guid notificationId, Guid userId);
    public Task UpdateNotificationAsync(Guid notificationId, NotificationUpdateDTO dto, Guid userId);
}