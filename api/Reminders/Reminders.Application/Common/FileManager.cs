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

    public Task DeleteAsync(string fileName)
    {
        var fullPath = Path.GetFullPath(Path.Combine(_storageRoot, fileName));
        var root = Path.TrimEndingDirectorySeparator(_storageRoot) + Path.DirectorySeparatorChar;
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (!fullPath.StartsWith(root, comparison) || Path.GetFileName(fileName) != fileName)
            throw new ArgumentException("Invalid avatar file name", nameof(fileName));

        try
        {
            File.Delete(fullPath);
        }
        catch (DirectoryNotFoundException)
        {
            // Deleting an already missing avatar is successful as well.
        }
        return Task.CompletedTask;
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
