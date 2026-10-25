namespace Reminders.Application.Exceptions;

public class NotValidNotificationException : RemindersException
{
    public NotValidNotificationException()
        : base($"Notification: not valid") { }
}