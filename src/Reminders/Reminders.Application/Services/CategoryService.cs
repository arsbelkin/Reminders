using MapsterMapper;
using Reminders.Application.Common;
using Reminders.Application.Enums;
using Reminders.Application.Exceptions;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Category;
using Reminders.Application.TransferModels.Notification;
using Reminders.Domain.Enums;
using Reminders.Domain.Models;

namespace Reminders.Application.Services;

public class CategoryService : ICategoryService
{
    private readonly ICategoryRepository _categoryRepository;
    private readonly IReminderRepository _reminderRepository;
    private readonly INotificationRepository _notificationRepository;
    private readonly IUserRepository _userRepository;
    private readonly IMapper _mapper;
    private readonly IRedisNotification _redis;

    public CategoryService(
        ICategoryRepository categoryRepository,
        IReminderRepository reminderRepository,
        IMapper mapper,
        INotificationRepository notificationRepository,
        IRedisNotification redis,
        IUserRepository userRepository
    )
    {
        _categoryRepository = categoryRepository;
        _mapper = mapper;
        _reminderRepository = reminderRepository;
        _notificationRepository = notificationRepository;
        _redis = redis;
        _userRepository = userRepository;
    }

    public async Task<Guid> CreateCategoryAsync(CategoryCreateDTO dto)
    {
        foreach (var email in dto.UsersEmails)
        {
            if (!EmailValidator.IsValid(email))
                throw new NotValidEmailException(email);

            if (!await _userRepository.CheckUserByEmailAsync(email))
                throw new NotValidEmailException(email);
        }

        var users = await _userRepository.GetAllUsersByEmailAsync(dto.UsersEmails);

        var category = new Category
        {
            Id = Guid.CreateVersion7(),
            CreatorId = dto.CreatorId,
            Title = dto.Title,
            Description = dto.Description,
            CreatedTime = DateTime.UtcNow,
            Members = users
        };

        await _categoryRepository.CreateCategoryAsync(category);
        return category.Id;
    }

    public async Task<List<CategoryListViewDTO>> GetUserCategoriesAsync(
        Guid userId,
        string? categoryName,
        Guid? categoryId
    )
    {
        var userCategoriesQuery = _categoryRepository.CreateCategoryQuery(categoryName, categoryId);

        var userCategories = await _categoryRepository.GetUserCategoriesAsync(
            userCategoriesQuery,
            userId);

        return _mapper.Map<List<CategoryListViewDTO>>(userCategories);
    }

    public async Task<CategoryInfoViewDTO> GetCategoryInfoAsync(Guid categoryId, Guid userId)
    {
        var userRemindersQuery = _reminderRepository.GetRemindersByUserIdQuery(userId);

        var categoryInfo = await _categoryRepository.GetCategoryInfoAsync(userId, categoryId, userRemindersQuery);

        if (categoryInfo == null)
            throw new NotValidCategoryException();

        return categoryInfo;
    }

    public async Task UpdateCategoryAsync(CategoryUpdateDTO dto)
    {
        var cat = await _categoryRepository.GetCategoryByIdAsync(dto.Id);

        if (cat == null)
            throw new NotValidCategoryException();

        if (dto.CreatorId != cat.CreatorId)
            throw new NotValidCategoryException();

        if (dto.Title is not null)
            cat.Title = dto.Title;

        cat.Description = dto.Description;

        await _categoryRepository.UpdateCategoryAsync(cat);

        var processedNotifications =
            await _notificationRepository.GetNotificationsByCategoryAsync(cat.Id,
                ProcessedStatusTypes.Processed);

        await _redis.UpdateNotificationsListAsync(processedNotifications);
    }

    public async Task DeleteCategoryAsync(CategoryDeleteDTO dto)
    {
        var cat = await _categoryRepository.GetCategoryByIdAsync(dto.Id);

        if (cat == null)
            throw new NotValidCategoryException();

        if (dto.CreatorId != cat.CreatorId)
            throw new NotValidCategoryException();

        var processedNotifications =
            await _notificationRepository.GetNotificationsByCategoryAsync(cat.Id,
                ProcessedStatusTypes.Processed);

        foreach (var notification in processedNotifications)
        {
            await _redis.ProcessMessageAsync(new NotificationWrapper
            {
                MessageType = MessageTypes.Delete,
                NotificationId = notification.Id,
            });
        }

        await _notificationRepository.DeleteNotificationByCategoryIdAsync(cat.Id);

        await _categoryRepository.DeleteCategoryAsync(cat);
    }
}