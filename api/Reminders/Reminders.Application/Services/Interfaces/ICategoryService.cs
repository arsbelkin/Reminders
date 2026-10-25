using Reminders.Application.TransferModels.Category;
using Reminders.Domain.Models;

namespace Reminders.Application.Services.Interfaces;

public interface ICategoryService
{
    public Task<Guid> CreateCategoryAsync(CategoryCreateDTO dto);

    public Task<List<CategoryListViewDTO>> GetUserCategoriesAsync(
        Guid userId,
        string? categoryName,
        Guid? categoryId
    );

    public Task<CategoryInfoViewDTO> GetCategoryInfoAsync(Guid categoryId, Guid userId);
    public Task UpdateCategoryAsync(CategoryUpdateDTO dto);
    public Task DeleteCategoryAsync(CategoryDeleteDTO dto);
}