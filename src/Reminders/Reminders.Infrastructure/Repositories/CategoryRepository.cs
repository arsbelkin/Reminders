using Microsoft.EntityFrameworkCore;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Domain.Models;
using Reminders.Infrastructure.Contexts;
using Reminders.Application.TransferModels.Category;

namespace Reminders.Infrastructure.Repositories;

public class CategoryRepository : ICategoryRepository
{
    private readonly RemindersContext _dbContext;

    public CategoryRepository(RemindersContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task CreateCategoryAsync(Category category)
    {
        _dbContext.Categories.Add(category);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<List<Category>> GetUserCategoriesAsync(IQueryable<Guid> userCategoriesQuery, Guid userId)
    {
        var categories = await _dbContext.Categories
            .Where(c => c.Members.Any(m => m.Id == userId))
            .Where(c => userCategoriesQuery.Contains(c.Id))
            .ToListAsync();

        return categories;
    }

    public async Task<CategoryInfoViewDTO?> GetCategoryInfoAsync(Guid userId, Guid categoryId)
    {
        var categoryInfo = await _dbContext.Categories
            .Where(c => c.Id == categoryId)
            .Where(c => c.Members.Any(m => m.Id == userId))
            .Select(c => new CategoryInfoViewDTO
            {
                Id = c.Id,
                CreatorId = c.CreatorId,
                Title = c.Title,
                CreatorEmail = _dbContext.Users.Where(u => u.Id == c.CreatorId).Select(u => u.Email).FirstOrDefault(),
                Description = c.Description,
                CreatedTime = c.CreatedTime,
                UsersEmails = c.Members.Select(m => m.Email).Distinct().ToList()
            })
            .FirstOrDefaultAsync();

        return categoryInfo;
    }

    public async Task<Category?> GetCategoryByIdAsync(Guid categoryId)
    {
        var cat = await _dbContext.Categories.FirstOrDefaultAsync(c => c.Id == categoryId);
        return cat;
    }

    public async Task UpdateCategoryAsync(Category category)
    {
        _dbContext.Categories.Update(category);
        await _dbContext.SaveChangesAsync();
    }

    public async Task DeleteCategoryAsync(Category category)
    {
        _dbContext.Categories.Remove(category);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<bool> CheckCategoryByIdAsync(Guid categoryId)
    {
        return await _dbContext.Categories.AnyAsync(c => c.Id == categoryId);
    }

    public IQueryable<Guid> CreateCategoryQuery(string? categoryName, Guid? categoryId)
    {
        var query = _dbContext.Categories.AsQueryable();

        if (!string.IsNullOrWhiteSpace(categoryName))
            query = query
                .Where(c => EF.Functions.ILike(c.Title, $"%{categoryName}%"));

        if (categoryId != null)
            query = query.Where(c => c.Id == categoryId);

        return query.Select(c => c.Id);
    }

    public async Task<bool> CheckMemberAsync(Guid userId, Guid categoryId)
    {
        return await _dbContext.Categories.AnyAsync(c => c.Id == categoryId && c.Members.Any(m => m.Id == userId));
    }
}