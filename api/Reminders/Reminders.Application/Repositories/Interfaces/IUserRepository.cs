using Reminders.Domain.Models;

namespace Reminders.Application.Repositories.Interfaces;

public interface IUserRepository
{
    public Task CreateUserAsync(User user);
    public Task<bool> CheckUserByEmailAsync(string email);
    public Task<bool> CheckUserByUsernameAsync(string username);
    public Task<User?> GetUserByUsernameOrEmailAsync(string inputString);
    public Task<List<User>> GetAllUsersByEmailAsync(List<string> emails);
    public Task<bool> CheckUserByIdAsync(Guid userId);
}