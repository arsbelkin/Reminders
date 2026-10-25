namespace Reminders.Application.Exceptions;

public class NotValidEmailException : RemindersException
{
    public NotValidEmailException(string email)
        : base($"Email: {email} is  not valid") { }
}