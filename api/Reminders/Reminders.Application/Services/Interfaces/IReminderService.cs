using Reminders.Application.TransferModels.Reminder;

namespace Reminders.Application.Services.Interfaces;

public interface IReminderService
{
    public Task<Guid> CreateReminderAsync(ReminderCreateDTO dto);
    public Task<List<ReminderListViewDTO>> GetUserRemindersAsync(Guid userId);
    public Task<ReminderInfoViewDTO> GetReminderInfoAsync(Guid reminderId, Guid userId);
    public Task<List<ReminderListViewDTO>> GetUserReminderByFilterAsync(
        Guid userId,
        ReminderSearchDTO searchDto
        );
    public Task UpdateReminderAsync(Guid reminderId, Guid userId, ReminderRequestDTO dto);
    public Task DeleteReminderAsync(Guid reminderId, Guid userId);

    public Task CompleteReminderAsync(Guid reminderId, Guid userId);
    public Task ReopenReminderAsync(Guid reminderId, Guid userId);
}