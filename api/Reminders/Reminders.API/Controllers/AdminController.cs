using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Admin;

namespace Reminders.API.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/v1/[controller]")]
public class AdminController : Controller
{
    private readonly IAdminService _adminService;

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }
    
    [HttpGet("report")]
    public async Task<ActionResult<List<AdminReportModel>>> GetReport()
    {
        var report = await _adminService.GetAdminReportAsync();
        return Ok(report);
    }
}