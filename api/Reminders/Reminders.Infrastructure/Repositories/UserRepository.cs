using Microsoft.EntityFrameworkCore;
using Reminders.Domain.Models;
using Reminders.Infrastructure.Contexts;
using Reminders.Application.Repositories.Interfaces;

namespace Reminders.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly RemindersContext _dbContext;
    
    public UserRepository(RemindersContext dbContext)
    {
        _dbContext = dbContext;
    }
    
    public async Task CreateUserAsync(User user)
    {
        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<bool> CheckUserByEmailAsync(string email)
    {
        return await _dbContext.Users.AnyAsync(u => u.Email == email);
    }
    
    public async Task<bool> CheckUserByUsernameAsync(string username)
    {
        return await _dbContext.Users.AnyAsync(u => u.Username == username);
    }

    public async Task<User?> GetUserByUsernameOrEmailAsync(string inputString)
    {
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => (u.Email == inputString) || 
                                                        (u.Username == inputString));

        return user;
    }

    public async Task<List<User>> GetAllUsersByEmailAsync(List<string> emails)
    {
        var users = await _dbContext.Users
            .Where(u => emails.Contains(u.Email))
            .ToListAsync();

        return users;
    }

    public async Task<bool> CheckUserByIdAsync(Guid userId)
    {
        return await _dbContext.Users.AnyAsync(u => u.Id == userId);
    }

    public async Task<User?> GetUserByIdAsync(Guid userId)
    {
        return await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
    }

    public async Task UpdateUserAsync(User user)
    {
        _dbContext.Users.Update(user);
        await _dbContext.SaveChangesAsync();
    }
}