using Reminders.Application.Common.Interfaces;

namespace Reminders.Application.Common;

public class BCryptHasherService : IHasher
{
    public string CalculateHash(string password)
    {
        var hashPassword = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 11);
        
        return hashPassword;
    }

    public bool VerifyHash(string password,  string hashedPassword)
    {
        return BCrypt.Net.BCrypt.Verify(password, hashedPassword);
    }
}