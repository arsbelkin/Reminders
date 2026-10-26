using Reminders.Application.Common.Interfaces;
using Reminders.Application.Exceptions;
using Reminders.Application.Repositories.Interfaces;
using Reminders.Application.Services.Interfaces;
using Reminders.Application.TransferModels.User;

namespace Reminders.Application.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IFileManager _fileManager;
    
    public UserService(IUserRepository userRepository, IFileManager fileManager)
    {
        _userRepository = userRepository;
        _fileManager = fileManager;
    }
    
    public async Task LoadAvatarAsync(Guid userId, UserFileDTO dto)
    {
        var user = await _userRepository.GetUserByIdAsync(userId);

        if (user == null)
            throw new NotValidUserException();

        var fileName = user.Id + dto.Extension;
        
        await _fileManager.SaveAsync(fileName, dto.File);

        user.AvatarFileName = fileName;
        
        await _userRepository.UpdateUserAsync(user);
    }

    public async Task<UserFileDTO?> GetAvatarAsync(Guid userId)
    {
        var user = await _userRepository.GetUserByIdAsync(userId);
        
        if (user == null)
            throw new NotValidUserException();

        if (user.AvatarFileName == null)
            return null;
        
        return await _fileManager.ReadAsync(user.AvatarFileName);
    }
}