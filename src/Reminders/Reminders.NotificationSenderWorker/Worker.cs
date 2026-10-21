using Reminders.Application.Enums;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Notification;

namespace Reminders.NotificationSenderWorker;

public class Worker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<Worker> _logger;
    
    public Worker(
        IServiceScopeFactory scopeFactory,
        ILogger<Worker> logger
    )
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            // if (_logger.IsEnabled(LogLevel.Information))
            // {
            //     _logger.LogInformation("SenderWorker running at: {time}", DateTimeOffset.Now);
            // }
            
            await DoWorkAsync(stoppingToken);
            
            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }

    private async Task DoWorkAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        
        var redis = scope.ServiceProvider.GetRequiredService<IRedisNotification>();
        
        var notificationRepository = scope.ServiceProvider.GetRequiredService<INotificationRepository>();
        
        var emailSenderService = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        
        var nowSeconds = DateTimeOffset.Now.ToUnixTimeSeconds();
        
        var readyMessages = await redis.GetReadyNotificationsAsync(nowSeconds);
        
        var notificationsIds = new List<Guid>();

        foreach (var readyMessage in readyMessages)
        {
            if (_logger.IsEnabled(LogLevel.Information))
            {
                _logger.LogInformation($"{readyMessage.ReceiverEmail}");
            }

            try
            {
                await emailSenderService.SendEmailAsync(readyMessage);
                await redis.ProcessMessageAsync(new NotificationWrapper
                {
                    MessageType = MessageTypes.Delete,
                    NotificationId = readyMessage.NotificationId
                });
                
                notificationsIds.Add(readyMessage.NotificationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, ex.Message);
            }
        }

        if (readyMessages.Count > 0)
        {
            await notificationRepository.SetNotProcessedNotificationsByListIdAsync(notificationsIds);
        }
    }
}