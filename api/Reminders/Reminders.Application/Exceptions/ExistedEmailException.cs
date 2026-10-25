namespace Reminders.Application.Exceptions;

public class ExistedEmailException : RemindersException
{
    public ExistedEmailException(string email)
        : base($"Email: {email} already exists") { }
}