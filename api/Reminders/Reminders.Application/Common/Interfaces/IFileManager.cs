using Reminders.Application.TransferModels.User;

namespace Reminders.Application.Common.Interfaces;

public interface IFileManager
{
    public Task SaveAsync(string fileName, byte[] data);
    public Task<UserFileDTO> ReadAsync(string fileName);
}