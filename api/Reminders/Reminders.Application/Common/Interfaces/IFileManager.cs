namespace Reminders.Application.Common.Interfaces;

public interface IFileManager
{
    public Task SaveAsync(string fileName, byte[] data);
    public Task<byte[]> ReadAsync(string fileName);
}