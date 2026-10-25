using Reminders.Application.TransferModels.Admin;

namespace Reminders.Application.Repositories.Interfaces;

public interface IAdminRepository
{
    public Task<List<AdminReportModel>> GetAdminReportAsync();
}