namespace Reminders.Application.Exceptions;

public abstract class RemindersException : Exception
{
    protected RemindersException(string message) : base(message) { }
}