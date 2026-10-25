namespace Reminders.Application.Exceptions;

public class LoginException : RemindersException
{
    public LoginException()
        : base("invalid credentials") { }
}