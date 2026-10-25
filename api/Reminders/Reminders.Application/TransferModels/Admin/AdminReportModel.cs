namespace Reminders.Application.TransferModels.Admin;

public class AdminReportModel
{
    public Guid UserId { get; set; }
    
    public string UserName { get; set; }
    
    public string Email { get; set; }
    
    public int NumberOfReminders { get; set; }
    
    public int NumberOfCompletedReminders { get; set; }
}