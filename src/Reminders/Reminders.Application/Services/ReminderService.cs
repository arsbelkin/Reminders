using MapsterMapper;
using Reminders.Application.Common;
using Reminders.Application.Enums;
using Reminders.Application.Exceptions;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Notification;
using Reminders.Application.TransferModels.Reminder;
using Reminders.Domain.Enums;
using Reminders.Domain.Models;

namespace Reminders.Application.Services;

public class ReminderService : IReminderService
{
    private readonly IReminderRepository _reminderRepository;
    private readonly IUserRepository _userRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly INotificationRepository _notificationRepository;
    private readonly IRedisNotification _redis;

    public ReminderService(
        IReminderRepository reminderRepository,
        IUserRepository userRepository,
        ICategoryRepository categoryRepository,
        INotificationRepository notificationRepository,
        IRedisNotification redisNotification
    )
    {
        _reminderRepository = reminderRepository;
        _userRepository = userRepository;
        _categoryRepository = categoryRepository;
        _notificationRepository = notificationRepository;
        _redis = redisNotification;
    }

    public async Task<Guid> CreateReminderAsync(ReminderCreateDTO dto)
    {
        foreach (var email in dto.UsersEmails)
        {
            if (!EmailValidator.IsValid(email))
                throw new NotValidEmailException(email);

            if (!await _userRepository.CheckUserByEmailAsync(email))
                throw new NotValidEmailException(email);

            if (!await _categoryRepository.CheckCategoryByIdAsync(dto.CategoryId))
                throw new NotValidCategoryException();
        }

        var users = await _userRepository.GetAllUsersByEmailAsync(dto.UsersEmails);

        var reminder = new Reminder
        {
            Id = Guid.CreateVersion7(),
            CreatorId = dto.CreatorId,
            CategoryId = dto.CategoryId,
            Title = dto.Title,
            Description = dto.Description,
            CreatedTime = DateTime.UtcNow,
            Priority = dto.Priority,
            IsCompleted = CompletedStatusTypes.NotCompleted,
            CompletedTime = null,
            DueDate = dto.DueDate,
            Members = users
        };

        await _reminderRepository.CreateReminderAsync(reminder);

        return reminder.Id;
    }

    public async Task<List<ReminderListViewDTO>> GetUserRemindersAsync(Guid userId)
    {
        var remindersView = await _reminderRepository.GetRemindersByUserIdAsync(userId);
        return remindersView;
    }

    public async Task<ReminderInfoViewDTO> GetReminderInfoAsync(Guid reminderId, Guid userId)
    {
        var reminderInfo = await _reminderRepository.GetReminderInfoAsync(reminderId, userId);

        if (reminderInfo == null)
            throw new NotValidReminderException();

        return reminderInfo;
    }

    public async Task<List<ReminderListViewDTO>> GetUserReminderByFilterAsync(
        Guid userId,
        ReminderSearchDTO searchDto
    )
    {
        var reminderQuery = _reminderRepository.CreateReminderQuery(userId, searchDto);
        var reminders = await _reminderRepository.GetRemindersByQuery(reminderQuery);

        return reminders;
    }

    public async Task UpdateReminderAsync(Guid reminderId, Guid userId, ReminderUpdateDTO dto)
    {
        var reminder = await _reminderRepository.GetReminderAsync(reminderId, userId);

        if (reminder == null)
            throw new NotValidReminderException();

        reminder.CategoryId = dto.CategoryId;
        reminder.Title = dto.Title;
        reminder.Description = dto.Description;
        reminder.Priority = dto.Priority;
        reminder.DueDate = dto.DueDate;
        
        await _reminderRepository.UpdateReminderAsync(reminder);
        
        var processedNotifications =
            await _notificationRepository.GetNotificationsByReminderAsync(reminderId, 
                ProcessedStatusTypes.Processed);

        await _redis.UpdateNotificationsListAsync(processedNotifications);
    }

    public async Task DeleteReminderAsync(Guid reminderId, Guid userId)
    {
        var reminder = await _reminderRepository.GetReminderAsync(reminderId, userId);

        if (reminder == null)
            throw new NotValidReminderException();
        
        var processedNotifications =
            await _notificationRepository.GetNotificationsByReminderAsync(reminderId, 
                ProcessedStatusTypes.Processed);

        foreach (var notification in processedNotifications)
        {
            await _redis.ProcessMessageAsync(new NotificationWrapper
            {
                MessageType = MessageTypes.Delete,
                NotificationId = notification.Id,
            });
        }

        await _reminderRepository.DeleteReminderAsync(reminder);
    }

    public async Task CompleteReminderAsync(Guid reminderId, Guid userId)
    {
        var reminder = await _reminderRepository.GetReminderAsync(reminderId, userId);

        if (reminder == null)
            throw new NotValidReminderException();

        reminder.IsCompleted = CompletedStatusTypes.Completed;
        reminder.CompletedTime = DateTime.UtcNow;

        var processedNotifications =
            await _notificationRepository.GetNotificationsByReminderAsync(reminderId, 
                ProcessedStatusTypes.Processed);

        foreach (var notification in processedNotifications)
        {
            await _redis.ProcessMessageAsync(new NotificationWrapper
            {
                MessageType = MessageTypes.Delete,
                NotificationId = notification.Id,
            });
        }
        
        await _notificationRepository.DeleteNotificationByReminderIdAsync(reminderId);

        await _reminderRepository.UpdateReminderAsync(reminder);
    }

    public async Task ReopenReminderAsync(Guid reminderId, Guid userId)
    {
        var reminder = await _reminderRepository.GetReminderAsync(reminderId, userId);

        if (reminder == null)
            throw new NotValidReminderException();

        reminder.IsCompleted = CompletedStatusTypes.NotCompleted;
        reminder.CompletedTime = null;

        await _reminderRepository.UpdateReminderAsync(reminder);
    }
}