using Reminders.Application.TransferModels.Category;
using Reminders.Domain.Models;

namespace Reminders.Application.Repositories.Interfaces;

public interface ICategoryRepository
{
    public Task CreateCategoryAsync(Category category);

    public Task<List<Category>> GetUserCategoriesAsync(IQueryable<Guid> userCategoriesQuery, Guid userId);

    public Task<CategoryInfoViewDTO?> GetCategoryInfoAsync(Guid userId, Guid categoryId);

    public Task<Category?> GetCategoryByIdAsync(Guid categoryId);
    public Task UpdateCategoryAsync(Category category);
    public Task DeleteCategoryAsync(Category category);
    public Task<bool> CheckCategoryByIdAsync(Guid categoryId);
    public IQueryable<Guid> CreateCategoryQuery(string? categoryName, Guid? categoryId);
    
    public Task<bool> CheckMemberAsync(Guid userId, Guid categoryId);
}