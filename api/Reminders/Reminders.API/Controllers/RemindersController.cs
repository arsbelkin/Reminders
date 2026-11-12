using System.Security.Claims;
using MapsterMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Reminder;
using Reminders.Application.TransferModels.Common;

namespace Reminders.API.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class RemindersController : Controller
{
    private readonly IReminderService _reminderService;
    private readonly IMapper _mapper;
    private readonly IUserService _userService;

    public RemindersController(IReminderService reminderService, IMapper mapper, IUserService userService)
    {
        _reminderService = reminderService;
        _mapper = mapper;
        _userService = userService;
    }

    [HttpPost]
    public async Task<ActionResult<IdResponseDTO>> Create([FromBody] ReminderRequestDTO dto)
    {
        var createDto = _mapper.Map<ReminderCreateDTO>(dto);
        createDto.CreatorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var userEmail = (await _userService.GetUserInfoAsync(createDto.CreatorId)).Email;
        
        if (!createDto.UsersEmails.Contains(userEmail))
            createDto.UsersEmails.Add(userEmail);
        
        var reminderId = await _reminderService.CreateReminderAsync(createDto);
        
        return Ok(new IdResponseDTO { Id = reminderId });
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
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var userEmail = (await _userService.GetUserInfoAsync(userId)).Email;
        
        if (!dto.UsersEmails.Contains(userEmail))
            dto.UsersEmails.Add(userEmail);
        
        await _reminderService.UpdateReminderAsync(reminderId, userId, dto);
        
        return NoContent();
    }

    [HttpDelete("{reminderId:guid}")]
    public async Task<ActionResult> DeleteReminder(Guid reminderId)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        await _reminderService.DeleteReminderAsync(reminderId, userId);
        
        return NoContent();
    }

    [HttpPost("{reminderId}/complete")]
    public async Task<ActionResult> CompleteReminder(Guid reminderId)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        await _reminderService.CompleteReminderAsync(reminderId, userId);
        
        return NoContent();
    }
    
    [HttpPost("{reminderId}/reopen")]
    public async Task<ActionResult> ReopenReminder(Guid reminderId)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        await _reminderService.ReopenReminderAsync(reminderId, userId);
        
        return NoContent();
    }
}
