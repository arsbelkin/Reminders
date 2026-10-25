namespace Reminders.Application.Exceptions;

public class NotValidUserException : RemindersException
{
    public NotValidUserException()
        : base("User exception") { }
}