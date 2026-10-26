using System.Diagnostics;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.User;

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
        if (file.Length == 0)
            return BadRequest("Image not selected");
        
        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png"};
        
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        
        if (!allowedExtensions.Contains(extension))
            return BadRequest("Invalid file format");
        
        if (file.Length > 2 * 1024 * 1024)
            return BadRequest("File too large");
        
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        var dto = new UserFileDTO();
        
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer);
        
        dto.File = buffer.ToArray();
        dto.Extension = extension;
        
        await _userService.LoadAvatarAsync(userId, dto);
        return Ok();
    }

    [HttpGet("avatar")]
    public async Task<IActionResult> GetAvatar()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        
        var avatar = await _userService.GetAvatarAsync(userId);

        if (avatar == null)
            return NotFound();

        var contentType = avatar.Extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            _ => "image/jpeg"
        };
        
        return File(avatar.File, contentType);
    }
}