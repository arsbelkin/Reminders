using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Admin;

namespace Reminders.Application.Services;

public class AdminService : IAdminService
{
    private readonly IAdminRepository _adminRepository;
    
    public AdminService(IAdminRepository adminRepository)
    {
        _adminRepository = adminRepository;
    }
    
    public async Task<List<AdminReportModel>> GetAdminReportAsync()
    {
        var report = await _adminRepository.GetAdminReportAsync();
        return report;
    }
}