using Reminders.Domain.Enums;

namespace Reminders.Domain.Models;

public class Reminder
{
    public Reminder()
    {
    }
    
    public Guid Id { get; set; }
    
    public Guid CreatorId { get; set; }
    
    public Guid CategoryId { get; set; }
    
    public string Title { get; set; }
    
    public string? Description { get; set; }
    
    public DateTime CreatedTime { get; set; }
    
    public PriorityTypes Priority { get; set; }
    
    public CompletedStatusTypes IsCompleted { get; set; }
    
    public DateTime? CompletedTime { get; set; }
    
    public DateTime? DueDate { get; set; }
    
    public User Creator { get; set; }
    
    public Category Category { get; set; }
    
    public ICollection<User> Members { get; set; } = new List<User>();
}