namespace Reminders.Domain.Models;

public class Category
{
    public Category()
    {
    }
    
    public Guid Id { get; set; }
    
    public Guid CreatorId { get; set; }
    
    public string Title { get; set; }
    
    public string? Description { get; set; }
    
    public DateTime CreatedTime { get; set; }
    
    public User Creator { get; set; }
    
    public ICollection<User> Members { get; set; } = new List<User>();
}