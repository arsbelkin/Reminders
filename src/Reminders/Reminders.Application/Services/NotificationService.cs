using Reminders.Application.Enums;
using Reminders.Application.Exceptions;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Notification;
using Reminders.Domain.Enums;
using Reminders.Domain.Models;

namespace Reminders.Application.Services;

public class NotificationService : INotificationService
{
    private readonly IReminderRepository _reminderRepository;
    private readonly INotificationRepository _notificationRepository;
    private readonly IRedisNotification _redis;

    public NotificationService(
        IReminderRepository reminderRepository,
        INotificationRepository notificationRepository,
        IRedisNotification redis
    )
    {
        _reminderRepository = reminderRepository;
        _notificationRepository = notificationRepository;
        _redis = redis;
    }

    public async Task<Guid> CreateNotificationAsync(NotificationCreateDTO dto, Guid userId)
    {
        if (!(await _reminderRepository.CheckUserReminderByIdAsync(dto.ReminderId, userId)))
            throw new NotValidReminderException();

        var notification = new Notification
        {
            Id = Guid.CreateVersion7(),
            ReminderId = dto.ReminderId,
            ReceiverId = userId,
            IsProcessed = ProcessedStatusTypes.NotProcessed,
            NotificationTime = dto.NotificationTime,
            Recurrency = dto.Recurrency
        };
        
        await _notificationRepository.CreateNotificationAsync(notification);
        
        var now = DateTime.Now;

        var nextHour = new DateTime(
            now.Year,
            now.Month,
            now.Day,
            now.Hour,
            now.Minute,
            now.Second
        ).AddSeconds(20);

        if (nextHour <= notification.NotificationTime.AddHours(1))
        {
            var ntf =  await _notificationRepository.GetNotificationAsync(notification.Id, userId);
        
            if  (ntf == null)
                throw new NotValidNotificationException();
            
            var message = new NotificationMessageDTO
            {
                NotificationId = ntf.Id,
                ReceiverEmail = ntf.Receiver.Email,
                ReceiverUsername = ntf.Receiver.Username,
                CategoryTitle = ntf.Reminder.Category.Title,
                ReminderTitle = ntf.Reminder.Title,
                ReminderDescription = ntf.Reminder.Description,
                NotificationTime = ntf.NotificationTime
            };

            await _redis.ProcessMessageAsync(new NotificationWrapper
            {
                NotificationId = ntf.Id,
                MessageType = MessageTypes.Add,
                NotificationMessage = message
            });
        }
        
        return notification.Id;
    }

    public async Task<List<NotificationListDTO>> GetUserNotificationsAsync(Guid userId)
    {
        var notifications = await _notificationRepository.GetUserNotificationsAsync(userId);

        return notifications;
    }

    public async Task DeleteNotificationAsync(Guid notificationId, Guid userId)
    {
        var notification = await _notificationRepository.GetNotificationAsync(notificationId, userId);

        if (notification == null)
            throw new NotValidReminderException();

        await _redis.ProcessMessageAsync(new NotificationWrapper
        {
            NotificationId = notification.Id,
            MessageType = MessageTypes.Delete
        });

        await _notificationRepository.DeleteNotificationAsync(notification);
    }

    public async Task UpdateNotificationAsync(Guid notificationId, NotificationUpdateDTO dto, Guid userId)
    {
        var notification = await _notificationRepository.GetNotificationAsync(notificationId, userId);

        if (notification == null)
            throw new NotValidReminderException();

        notification.NotificationTime = dto.NotificationTime;
        notification.Recurrency = dto.Recurrency;
        
        var now = DateTime.Now;

        var nextHour = new DateTime(
            now.Year,
            now.Month,
            now.Day,
            now.Hour,
            now.Minute,
            now.Second
        ).AddSeconds(20);

        if (nextHour <= notification.NotificationTime.AddHours(1))
        {
            var message = new NotificationMessageDTO
            {
                NotificationId = notification.Id,
                ReceiverEmail = notification.Receiver.Email,
                ReceiverUsername = notification.Receiver.Username,
                CategoryTitle = notification.Reminder.Category.Title,
                ReminderTitle = notification.Reminder.Title,
                ReminderDescription = notification.Reminder.Description,
                NotificationTime = notification.NotificationTime
            };

            await _redis.ProcessMessageAsync(new NotificationWrapper
            {
                NotificationId = notification.Id,
                MessageType = MessageTypes.Update,
                NotificationMessage = message
            });
        }

        await _notificationRepository.UpdateNotificationAsync(notification);
    }
}