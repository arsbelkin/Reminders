namespace Reminders.Domain.Models;

public class User
{
    public User()
    {
    }
    
    public Guid Id { get; set; }
    
    public string Username { get; set; }
    
    public string Email { get; set; }
    
    public string PasswordHash { get; set; }
    
    public DateTime CreatedTime { get; set; }
    
    public bool IsAdmin { get; set; }
}
