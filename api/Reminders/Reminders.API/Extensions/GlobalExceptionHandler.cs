using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Reminders.Application.Exceptions;

namespace Reminders.API.Extensions;

public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        int statusCode = StatusCodes.Status500InternalServerError;
        string title = "Внутренняя ошибка сервера";

        if (exception is RemindersException)
        {
            title = exception.Message;
            statusCode = exception switch
            {
                NotValidEmailException => StatusCodes.Status422UnprocessableEntity,
                MatchPasswordException => StatusCodes.Status401Unauthorized,
                ExistedEmailException => StatusCodes.Status409Conflict,
                ExistedUsernameException => StatusCodes.Status409Conflict,
                LoginException => StatusCodes.Status401Unauthorized,
                NotValidCategoryException => StatusCodes.Status404NotFound,
                NotValidReminderException => StatusCodes.Status404NotFound,
                NotValidUserException => StatusCodes.Status400BadRequest,
                NotValidNotificationException => StatusCodes.Status404NotFound,
                _ => StatusCodes.Status400BadRequest
            };
        }
        else
        {
            _logger.LogError(exception, "Непредвиденная системная ошибка");
        }
        
        httpContext.Response.StatusCode = statusCode;

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Instance = httpContext.Request.Path
        };

        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
        return true;
    }
}