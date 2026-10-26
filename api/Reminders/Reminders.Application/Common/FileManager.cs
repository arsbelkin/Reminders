using Microsoft.Extensions.Configuration;
using Reminders.Application.Common.Interfaces;
using Reminders.Application.TransferModels.User;

namespace Reminders.Application.Common;

public class FileManager : IFileManager
{
    private readonly string _storageRoot;

    public FileManager(IConfiguration configuration)
    {
        var root = configuration["AvatarStorage:RootPath"];
        _storageRoot = Path.GetFullPath(root);
    }
    
    public async Task SaveAsync(string fileName, byte[] data)
    {
        var fullPath = Path.Combine(_storageRoot, fileName);
        await File.WriteAllBytesAsync(fullPath, data);
    }

    public async Task<UserFileDTO> ReadAsync(string fileName)
    {
        var fullPath = Path.Combine(_storageRoot, fileName);
        
        var dto = new UserFileDTO
        {
            File = await File.ReadAllBytesAsync(fullPath),
            Extension = Path.GetExtension(fileName)
        };
        
        return dto;
    }
}