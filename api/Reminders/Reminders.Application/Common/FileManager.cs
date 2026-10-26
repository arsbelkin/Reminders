using System.Net;
using Microsoft.Extensions.Configuration;
using Reminders.Application.Common.Interfaces;

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

    public async Task<byte[]> ReadAsync(string fileName)
    {
        var fullPath = Path.Combine(_storageRoot, fileName);
        
        return await File.ReadAllBytesAsync(fullPath);
    }
}