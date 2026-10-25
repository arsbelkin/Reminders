using Microsoft.EntityFrameworkCore;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.TransferModels.Reminder;
using Reminders.Domain.Models;
using Reminders.Infrastructure.Contexts;

namespace Reminders.Infrastructure.Repositories;

public class ReminderRepository : IReminderRepository
{
    private readonly RemindersContext _dbContext;

    public ReminderRepository(RemindersContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task CreateReminderAsync(Reminder reminder)
    {
        _dbContext.Reminders.Add(reminder);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<List<ReminderListViewDTO>> GetRemindersByUserIdAsync(Guid userId)
    {
        var reminders = await _dbContext.Reminders
            .Where(r => r.Members.Any(m => m.Id == userId))
            .Select(r => new ReminderListViewDTO
            {
                Id = r.Id,
                CategoryId = r.CategoryId,
                CategoryName = r.Category.Title,
                Title = r.Title,
                Priority = r.Priority,
                IsCompleted = r.IsCompleted
            })
            .ToListAsync();

        return reminders;
    }

    public IQueryable<Guid> GetRemindersByUserIdQuery(Guid userId)
    {
        var query = _dbContext.Reminders
            .Where(r => r.Members.Any(m => m.Id == userId))
            .Select(r => r.CategoryId);

        return query;
    }

    public async Task<ReminderInfoViewDTO?> GetReminderInfoAsync(Guid reminderId, Guid userId)
    {
        var reminderInfo = await _dbContext.Reminders
            .Where(r => r.Id == reminderId)
            .Where(r => r.Members.Any(m => m.Id == userId))
            .Select(r => new ReminderInfoViewDTO
            {
                Id = r.Id,
                CreatorId = r.CreatorId,
                CategoryId = r.CategoryId,
                CategoryName = r.Category.Title,
                Title = r.Title,
                Description = r.Description,
                CreatedTime = r.CreatedTime,
                Priority = r.Priority,
                IsCompleted = r.IsCompleted,
                CompletedTime = r.CompletedTime,
                DueDate = r.DueDate,
                MemberEmails = r.Members.Select(m => m.Email).ToList()
            })
            .FirstOrDefaultAsync();

        return reminderInfo;
    }

    public IQueryable<Reminder> CreateReminderQuery(Guid userId, ReminderSearchDTO searchDto)
    {
        var query = _dbContext.Reminders
            .Where(r => r.Members.Any(m => m.Id == userId));

        if (!string.IsNullOrWhiteSpace(searchDto.SearchText))
            query = query.Where(r => EF.Functions.ILike(r.Title, $"%{searchDto.SearchText}%"));

        if (searchDto.CategoryIds.Count > 0)
            query = query.Where(r => searchDto.CategoryIds.Contains(r.CategoryId));

        if (searchDto.PriorityTypes.Count > 0)
            query = query.Where(r => searchDto.PriorityTypes.Contains(r.Priority));

        if (searchDto.FromDate != null)
            query = query.Where(r => r.CreatedTime >= searchDto.FromDate.Value);

        if (searchDto.ToDate != null)
            query = query.Where(r => r.CreatedTime <= searchDto.ToDate.Value);

        if (searchDto.CompletedStatus != null)
            query = query.Where(r => r.IsCompleted == searchDto.CompletedStatus.Value);

        if (searchDto.Page != null && searchDto.PageSize != null)
            query = query.OrderByDescending(r => r.CreatedTime)
                .Skip((searchDto.Page.Value - 1) * searchDto.PageSize.Value)
                .Take(searchDto.PageSize.Value);

        return query;
    }

    public async Task<List<ReminderListViewDTO>> GetRemindersByQuery(IQueryable<Reminder> query)
    {
        var reminders = await query.Select(r => new ReminderListViewDTO
            {
                Id = r.Id,
                CategoryId = r.CategoryId,
                CategoryName = r.Category.Title,
                Title = r.Title,
                Priority = r.Priority,
                IsCompleted = r.IsCompleted
            })
            .ToListAsync();

        return reminders;
    }

    public async Task<Reminder?> GetReminderAsync(Guid reminderId, Guid userId)
    {
        return await _dbContext.Reminders
            .Include(r => r.Members)
            .FirstOrDefaultAsync(r => r.Id == reminderId
                                      && r.Members.Any(m => m.Id == userId));
    }

    public async Task UpdateReminderAsync(Reminder reminder)
    {
        _dbContext.Reminders.Update(reminder);
        await _dbContext.SaveChangesAsync();
    }

    public async Task DeleteReminderAsync(Reminder reminder)
    {
        _dbContext.Reminders.Remove(reminder);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<bool> CheckUserReminderByIdAsync(Guid reminderId, Guid userId)
    {
        return await _dbContext.Reminders
            .AnyAsync(r => (r.Id == reminderId)
                && (r.Members.Any(m => m.Id == userId)));
    }
    
    public async Task<List<Guid>> UpdateReminderWithMembersAsync(
        Reminder reminder,
        List<Guid> removedMemberIds)
    {
        var notifications = await _dbContext.Notifications
            .Where(n => n.ReminderId == reminder.Id &&
                        removedMemberIds.Contains(n.ReceiverId))
            .ToListAsync();

        _dbContext.Notifications.RemoveRange(notifications);
        _dbContext.Reminders.Update(reminder);

        await _dbContext.SaveChangesAsync();

        return notifications.Select(n => n.Id).ToList();
    }
}