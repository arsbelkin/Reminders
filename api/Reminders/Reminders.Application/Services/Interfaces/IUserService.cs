using Reminders.Application.TransferModels.User;

namespace Reminders.Application.Services.Interfaces;

public interface IUserService
{
    public Task LoadAvatarAsync(Guid userId, UserFileDTO dto);
    public Task<UserFileDTO?> GetAvatarAsync(Guid userId);
    
    public Task<UserInfoDTO> GetUserInfoAsync(Guid userId);
    
    public Task<UserListResponseDTO> GetUsersAsync(UserGetRequestDTO dto);
}