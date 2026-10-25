using Reminders.Application.TransferModels.Notification;

namespace Reminders.Application.Services.Interfaces;

public interface IEmailSender
{
    public Task SendEmailAsync(NotificationMessageDTO message);
}