namespace Reminders.Application.Exceptions;

public class NotValidCategoryException : RemindersException
{
    public NotValidCategoryException()
        : base($"Category is not valid.") { }
}