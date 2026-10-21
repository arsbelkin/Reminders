using Reminders.Domain.Models;
using Reminders.Application.TransferModels.Reminder;

namespace Reminders.Application.Repositories.Interfaces;

public interface IReminderRepository
{
    public Task CreateReminderAsync(Reminder reminder);
    public Task<List<ReminderListViewDTO>> GetRemindersByUserIdAsync(Guid userId);
    public IQueryable<Guid>  GetRemindersByUserIdQuery(Guid userId);
    public Task<ReminderInfoViewDTO?> GetReminderInfoAsync(Guid reminderId, Guid userId);
    public IQueryable<Reminder> CreateReminderQuery(Guid userId, ReminderSearchDTO searchDto);
    public Task<List<ReminderListViewDTO>> GetRemindersByQuery(IQueryable<Reminder> query);
    public Task<Reminder?> GetReminderAsync(Guid reminderId, Guid userId);
    public Task UpdateReminderAsync(Reminder reminder);
    public Task DeleteReminderAsync(Reminder reminder);
    public Task<bool> CheckUserReminderByIdAsync(Guid reminderId, Guid userId);
    public Task<List<Guid>> UpdateReminderWithMembersAsync(Reminder reminder, List<Guid> removedMemberIds);
}