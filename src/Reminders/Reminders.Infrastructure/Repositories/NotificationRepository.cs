using Microsoft.EntityFrameworkCore;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.TransferModels.Notification;
using Reminders.Domain.Enums;
using Reminders.Domain.Models;
using Reminders.Infrastructure.Contexts;

namespace Reminders.Infrastructure.Repositories;

public class NotificationRepository : INotificationRepository
{
    private readonly RemindersContext _dbContext;

    public NotificationRepository(RemindersContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task CreateNotificationAsync(Notification notification)
    {
        await _dbContext.Notifications.AddAsync(notification);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<List<Notification>> GetComingNotificationsAsync()
    {
        var now = DateTime.UtcNow;
        var nextHour = now.AddHours(1);

        var res = await _dbContext.Notifications
            .Where(n => n.IsProcessed == ProcessedStatusTypes.NotProcessed &&
                        n.NotificationTime > now &&
                        n.NotificationTime <= nextHour)
            .Include(n => n.Receiver)
            .Include(n => n.Reminder)
            .ThenInclude(r => r.Category)
            .ToListAsync();

        return res;
    }

    public async Task UpdateNotificationsListAsync(List<Notification> notifications)
    {
        foreach (var notification in notifications)
        {
            _dbContext.Notifications.Update(notification);
        }

        await _dbContext.SaveChangesAsync();
    }

    public async Task<List<NotificationListDTO>> GetUserNotificationsAsync(Guid userId)
    {
        var res = await _dbContext.Notifications
            .Where(x => x.Receiver.Id == userId)
            .Select(x => new NotificationListDTO
            {
                Id = x.Id,
                CategoryId = x.Reminder.CategoryId,
                CategoryTitle =  x.Reminder.Category.Title,
                ReminderId = x.ReminderId,
                ReminderTitle = x.Reminder.Title,
                ReminderDescription =  x.Reminder.Description,
                NotificationTime = x.NotificationTime,
                Recurrency = x.Recurrency
            }).ToListAsync();

        return res;
    }

    public async Task<Notification?> GetNotificationAsync(Guid notificationId, Guid userId)
    {
        var res = await _dbContext.Notifications
            .Include(x => x.Receiver)
            .Include(x => x.Reminder)
            .ThenInclude(r => r.Category)
            .FirstOrDefaultAsync(x => x.Id == notificationId && x.Receiver.Id == userId);

        return res;
    }

    public async Task DeleteNotificationAsync(Notification notification)
    {
        _dbContext.Notifications.Remove(notification);
        await _dbContext.SaveChangesAsync(CancellationToken.None);
    }

    public async Task SetNotProcessedNotificationsByListIdAsync(List<Guid> notificationIds)
    {
        await _dbContext.Notifications
            .Where(x => notificationIds.Contains(x.Id))
            .ExecuteUpdateAsync(s =>
                s.SetProperty(n => n.IsProcessed, ProcessedStatusTypes.NotProcessed));
    }

    public async Task<List<Notification>> GetNotificationsByReminderAsync(
        Guid reminderId,
        ProcessedStatusTypes status)
    {
        return await _dbContext.Notifications
            .Where(n => n.ReminderId == reminderId && n.IsProcessed == status)
            .Include(n => n.Receiver)
            .Include(n => n.Reminder)
            .ThenInclude(r => r.Category)
            .ToListAsync();
    }

    public async Task DeleteNotificationByReminderIdAsync(Guid reminderId)
    {
        await _dbContext.Notifications
            .Where(n => n.ReminderId == reminderId)
            .ExecuteDeleteAsync();
    }

    public async Task<List<Notification>> GetNotificationsByCategoryAsync(
        Guid categoryId,
        ProcessedStatusTypes status)
    {
        return await _dbContext.Notifications
            .Where(n => n.Reminder.CategoryId == categoryId &&
                        n.IsProcessed == status)
            .Include(n => n.Receiver)
            .Include(n => n.Reminder)
            .ThenInclude(r => r.Category)
            .ToListAsync();
    }

    public async Task DeleteNotificationByCategoryIdAsync(Guid categoryId)
    {
        await _dbContext.Notifications
            .Where(n => n.Reminder.CategoryId == categoryId)
            .ExecuteDeleteAsync();
    }

    public async Task UpdateNotificationAsync(Notification notification)
    {
        _dbContext.Notifications.Update(notification);
        await _dbContext.SaveChangesAsync();
    }
}