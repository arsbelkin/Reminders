using Microsoft.EntityFrameworkCore;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.TransferModels.Admin;
using Reminders.Domain.Enums;
using Reminders.Infrastructure.Contexts;

namespace Reminders.Infrastructure.Repositories;

public class AdminRepository : IAdminRepository
{
    private readonly RemindersContext _dbContext;

    public AdminRepository(RemindersContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<AdminReportModel>> GetAdminReportAsync()
    {
        var report = await _dbContext.Users
            .Select(u => new AdminReportModel
            {
                UserId = u.Id,
                UserName = u.Username,
                Email = u.Email,
                
                NumberOfReminders = _dbContext.Reminders.Count(r => r.Members.Any(m => m.Id == u.Id)),
                
                NumberOfCompletedReminders = _dbContext.Reminders.Count(r =>
                    r.IsCompleted == CompletedStatusTypes.Completed && r.Members.Any(m => m.Id == u.Id))
            })
            .ToListAsync();

        return report;
    }
}