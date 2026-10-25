using Reminders.Application.TransferModels.Admin;

namespace Reminders.Application.Services.Interfaces;

public interface IAdminService
{
    public Task<List<AdminReportModel>> GetAdminReportAsync();
}