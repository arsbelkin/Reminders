namespace Reminders.Application.Exceptions;

public class NotValidReminderException : RemindersException
{
    public NotValidReminderException()
        : base($"Reminder: not valid") { }
}