using System.Security.Claims;
using MapsterMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Reminder;

namespace Reminders.API.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class RemindersController : Controller
{
    private readonly IReminderService _reminderService;
    private readonly IMapper _mapper;

    public RemindersController(IReminderService reminderService, IMapper mapper)
    {
        _reminderService = reminderService;
        _mapper = mapper;
    }

    [HttpPost]
    public async Task<ActionResult<Guid>> Create([FromBody] ReminderRequestDTO dto)
    {
        var userEmail =  User.FindFirstValue(ClaimTypes.Email);
        
        var createDto = _mapper.Map<ReminderCreateDTO>(dto);
        createDto.CreatorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        
        if (!createDto.UsersEmails.Contains(userEmail))
            createDto.UsersEmails.Add(userEmail);
        
        var reminderId = await _reminderService.CreateReminderAsync(createDto);
        
        return Ok(new {ReminderId = reminderId});
    }

    [HttpGet]
    public async Task<ActionResult<List<ReminderListViewDTO>>> GetUserReminders()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var reminders = await _reminderService.GetUserRemindersAsync(userId);

        return Ok(reminders);
    }
    
    [HttpPost("search")]
    public async Task<ActionResult<List<ReminderListViewDTO>>> GetUserRemindersByFilter(
        [FromBody] ReminderSearchDTO searchDto
        )
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var reminders = await _reminderService.GetUserReminderByFilterAsync(userId, searchDto);

        return Ok(reminders);
    }
    
    [HttpGet("{reminderId:guid}")]
    public async Task<ActionResult<ReminderInfoViewDTO>> GetReminderInfo(Guid reminderId)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var reminderInfo = await  _reminderService.GetReminderInfoAsync(reminderId, userId);
        
        return  Ok(reminderInfo);
    }

    [HttpPatch("{reminderId:guid}")]
    public async Task<ActionResult> UpdateReminder(Guid reminderId, [FromBody] ReminderRequestDTO dto)
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email);
        
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        
        if (!dto.UsersEmails.Contains(userEmail))
            dto.UsersEmails.Add(userEmail);
        
        await _reminderService.UpdateReminderAsync(reminderId, userId, dto);
        
        return Ok(new {message = "Reminder updated successfully"});
    }

    [HttpDelete("{reminderId:guid}")]
    public async Task<ActionResult> DeleteReminder(Guid reminderId)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        await _reminderService.DeleteReminderAsync(reminderId, userId);
        
        return Ok(new { message = "Reminder deleted successfully" });
    }

    [HttpPost("{reminderId}/complete")]
    public async Task<ActionResult> CompleteReminder(Guid reminderId)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        await _reminderService.CompleteReminderAsync(reminderId, userId);
        
        return Ok(new { message = "Reminder complete successfully" });
    }
    
    [HttpPost("{reminderId}/reopen")]
    public async Task<ActionResult> ReopenReminder(Guid reminderId)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        await _reminderService.ReopenReminderAsync(reminderId, userId);
        
        return Ok(new { message = "Reminder reopen successfully" });
    }
}