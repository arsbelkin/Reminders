namespace Reminders.Application.Exceptions;

public class MatchPasswordException : RemindersException
{
    public MatchPasswordException()
        : base("Passwords do not match") { }
}