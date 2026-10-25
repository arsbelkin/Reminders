namespace Reminders.Application.TransferModels.Admin;

public class AdminReminderStatsModel
{
    public Guid UserId { get; set; }

    public int NumberOfReminders { get; set; }

    public int NumberOfCompletedReminders { get; set; }
}