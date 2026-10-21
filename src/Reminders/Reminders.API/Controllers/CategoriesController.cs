using System.Security.Claims;
using MapsterMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.Category;

namespace Reminders.API.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class CategoriesController : Controller
{
    private readonly ICategoryService _categoryService;
    private readonly IMapper _mapper;

    public CategoriesController(ICategoryService categoryService, IMapper mapper)
    {
        _categoryService = categoryService;
        _mapper = mapper;
    }

    [HttpPost]
    public async Task<ActionResult<Guid>> Create([FromBody] CategoryRequestDTO dto)
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email);
        
        var createDto = _mapper.Map<CategoryCreateDTO>(dto);
        createDto.CreatorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        
        if (!createDto.UsersEmails.Contains(userEmail))
            createDto.UsersEmails.Add(userEmail);

        var categoryId = await _categoryService.CreateCategoryAsync(createDto);
        return Ok(new { CategoryId = categoryId });
    }

    [HttpGet]
    public async Task<ActionResult<List<CategoryListViewDTO>>> GetUserCategories(
        [FromQuery] string? categoryName,
        [FromQuery] Guid? categoryId
    )
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var userCategories = await _categoryService.GetUserCategoriesAsync(
            userId,
            categoryName,
            categoryId);

        return Ok(userCategories);
    }

    [HttpGet("{categoryId:guid}")]
    public async Task<CategoryInfoViewDTO> GetCategoryInfo(Guid categoryId)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var categoryInfo = await _categoryService.GetCategoryInfoAsync(categoryId, userId);

        return categoryInfo;
    }

    [HttpPatch("{categoryId:guid}")]
    public async Task<ActionResult> UpdateCategory(Guid categoryId, [FromBody] CategoryRequestDTO dto)
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email);
        
        var updateDto = _mapper.Map<CategoryUpdateDTO>(dto);
        updateDto.UserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        updateDto.Id = categoryId;
        
        if (!updateDto.UsersEmails.Contains(userEmail))
            updateDto.UsersEmails.Add(userEmail);

        await _categoryService.UpdateCategoryAsync(updateDto);

        return Ok(new { message = "Category updated successfully" });
    }

    [HttpDelete("{categoryId:guid}")]
    public async Task<ActionResult> DeleteCategory(Guid categoryId)
    {
        var deleteDto = new CategoryDeleteDTO
        {
            Id = categoryId,
            UserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier))
        };

        await _categoryService.DeleteCategoryAsync(deleteDto);
        return Ok(new { message = "Category deleted successfully" });
    }
}