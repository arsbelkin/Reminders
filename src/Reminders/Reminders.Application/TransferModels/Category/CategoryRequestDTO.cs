namespace Reminders.Application.TransferModels.Category;

public class CategoryRequestDTO
{
    public string Title { get; set; }
    
    public string? Description { get; set; }
    
    public List<string> UsersEmails { get; set; } = new List<string>();
}