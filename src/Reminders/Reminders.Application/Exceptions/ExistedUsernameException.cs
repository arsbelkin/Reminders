namespace Reminders.Application.Exceptions;

public class ExistedUsernameException : RemindersException
{
    public ExistedUsernameException(string username)
        : base($"Username: {username} already exists") { }
}