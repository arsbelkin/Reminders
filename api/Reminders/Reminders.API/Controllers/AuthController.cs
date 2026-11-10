using Microsoft.AspNetCore.Mvc;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Auth;
using Reminders.Application.TransferModels.Common;

namespace Reminders.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : Controller
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<ActionResult<IdResponseDTO>> Register([FromBody] UserRegisterDTO registerDto)
    {
        var userId = await _authService.RegisterUserAsync(registerDto);
        return Ok(new IdResponseDTO { Id = userId });
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponseDTO>> Login([FromBody] UserLoginDTO dto)
    {
        var token = await _authService.LoginAsync(dto);

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.Now.AddMinutes(15)
        };

        Response.Cookies.Append("X-Access-Token", token, cookieOptions);

        return Ok(new LoginResponseDTO { Token = token });
    }

    [HttpPost("logout")]
    public ActionResult Logout()
    {
        Response.Cookies.Delete("X-Access-Token");
        return Ok();
    }
}