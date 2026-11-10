using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Notification;
using Reminders.Application.TransferModels.Common;

namespace Reminders.API.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class NotificationsController : Controller
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpPost]
    public async Task<ActionResult<IdResponseDTO>> CreateNotification([FromBody] NotificationCreateDTO dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var notificationId = await _notificationService.CreateNotificationAsync(dto, userId);

        return Ok(new IdResponseDTO { Id = notificationId });
    }

    [HttpGet]
    public async Task<ActionResult<List<NotificationListDTO>>> GetUserNotifications()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var notifications = await _notificationService.GetUserNotificationsAsync(userId);
        
        return Ok(notifications);
    }

    [HttpDelete("{notificationId}")]
    public async Task<ActionResult> DeleteNotification(Guid notificationId)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        await _notificationService.DeleteNotificationAsync(notificationId, userId);
        
        return NoContent();
    }

    [HttpPatch("{notificationId:guid}")]
    public async Task<ActionResult> UpdateNotification(Guid notificationId, [FromBody] NotificationUpdateDTO dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        await _notificationService.UpdateNotificationAsync(notificationId, dto, userId);
        
        return NoContent();
    }
}