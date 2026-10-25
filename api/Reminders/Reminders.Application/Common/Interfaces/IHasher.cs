namespace Reminders.Application.Common.Interfaces;

public interface IHasher
{
    public string CalculateHash(string password);
    public bool VerifyHash(string password, string hashedPassword);
}