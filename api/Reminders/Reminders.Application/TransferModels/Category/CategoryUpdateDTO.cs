namespace Reminders.Application.TransferModels.Category;

public class CategoryUpdateDTO
{
    public Guid Id { get; set; }
    
    public Guid UserId { get; set; }
    
    public string? Title { get; set; }
    
    public string? Description { get; set; }
    
    public List<string> UsersEmails { get; set; } = new List<string>();
}