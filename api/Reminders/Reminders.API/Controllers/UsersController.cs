using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Reminders.Application.Services.Interfaces;

namespace Reminders.API.Controllers;


[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class UsersController : Controller
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpPut("avatar")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(3 *  1024 * 1024)]
    public async Task<IActionResult> LoadAvatar([FromForm] IFormFile file)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer);
        
        await _userService.LoadAvatarAsync(userId, buffer.ToArray());
        return Ok();
    }

    [HttpGet("avatar")]
    public async Task<IActionResult> GetAvatar()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        
        var avatar = await _userService.GetAvatarAsync(userId);

        if (avatar == null)
            return NotFound();
        
        return File(avatar, "image/jpeg");
    }
}