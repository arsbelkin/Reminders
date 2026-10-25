using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using Reminders.Application.Configurations;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Notification;

namespace Reminders.Infrastructure.Messaging;

public class EmailSender : IEmailSender
{
    private readonly SmtpYandexOptions _options;

    public EmailSender(IOptions<SmtpYandexOptions> options)
    {
        _options = options.Value;
    }
    
    public async Task SendEmailAsync(NotificationMessageDTO message)
    {
        var m = new MimeMessage();
        m.From.Add(new MailboxAddress("reminders service", _options.User));
        m.To.Add(new MailboxAddress("", message.ReceiverEmail));
        m.Subject = message.ReminderTitle;

        m.Body = new TextPart("html") { Text = GenerateEmailBody(message) };

        using var client = new SmtpClient();

        await client.ConnectAsync(_options.Host, _options.Port, SecureSocketOptions.Auto);
        await client.AuthenticateAsync(_options.User, _options.Password);
        await client.SendAsync(m);
        await client.DisconnectAsync(true);
    }
    
    private string GenerateEmailBody(NotificationMessageDTO message)
    {
        return $@"
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
            <h2 style='color: #4A90E2;'>🔔 Напоминание!</h2>
            <p>Здравствуйте, {message.ReceiverUsername}!</p>
            <p>Напоминаем вам о задаче из категории <strong>{message.CategoryTitle}</strong>:</p>
            
            <div style='background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4A90E2; margin: 20px 0;'>
                <h3 style='margin-top: 0; color: #333;'>{message.ReminderTitle}</h3>
                <p style='color: #666; margin-bottom: 0;'>{message.ReminderDescription}</p>
            </div>
            
            <p style='font-size: 12px; color: #999; margin-top: 30px;'>
                Запланированное время уведомления: {message.NotificationTime:dd.MM.yyyy HH:mm} (UTC)
            </p>
        </div>";
    }

}