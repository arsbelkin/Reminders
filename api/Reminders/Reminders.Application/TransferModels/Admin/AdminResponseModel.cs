namespace Reminders.Application.TransferModels.Admin;

public class AdminResponseModel
{
    public string Title { get; set; }
    
    public string Description { get; set; }

    public List<AdminReportModel> Report { get; set; } = new List<AdminReportModel>();
}