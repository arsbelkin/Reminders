namespace Reminders.Application.Services.Interfaces;

public interface IUserService
{
    public Task LoadAvatarAsync(Guid userId, byte[] avatar);
    public Task<byte[]?> GetAvatarAsync(Guid userId);
}