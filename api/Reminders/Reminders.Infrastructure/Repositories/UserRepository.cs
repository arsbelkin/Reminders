using MapsterMapper;
using Microsoft.EntityFrameworkCore;
using Reminders.Domain.Models;
using Reminders.Infrastructure.Contexts;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.TransferModels.User;

namespace Reminders.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly RemindersContext _dbContext;
    private readonly IMapper _mapper;

    public UserRepository(RemindersContext dbContext, IMapper mapper)
    {
        _dbContext = dbContext;
        _mapper = mapper;
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

    public async Task<UserInfoDTO?> GetUserInfoAsync(Guid userId)
    {
        var res = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (res == null)
            return null;

        return _mapper.Map<UserInfoDTO>(res);
    }

    public async Task<UserListResponseDTO> GetUsersAsync(UserGetRequestDTO dto)
    {
        var q = CreateSearchQuery(dto);
        var ids = await q.Select(u => u.Id).ToListAsync();

        return new UserListResponseDTO { Ids = ids };
    }

    private IQueryable<User> CreateSearchQuery(UserGetRequestDTO dto)
    {
        var query = _dbContext.Users.AsQueryable();
        
        if (!string.IsNullOrWhiteSpace(dto.Email))
            query = query.Where(u => EF.Functions.ILike(u.Email, $"%{dto.Email}%"));

        if (!string.IsNullOrWhiteSpace(dto.Username))
            query = query.Where(u => EF.Functions.ILike(u.Username, $"%{dto.Username}%"));

        return query;
    }
}