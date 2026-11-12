using System.ComponentModel.DataAnnotations;

namespace Reminders.Application.TransferModels.User;

public class UserUpdateDTO
{
    [Required, StringLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = string.Empty;
}
