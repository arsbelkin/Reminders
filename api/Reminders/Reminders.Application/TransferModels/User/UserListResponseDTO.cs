namespace Reminders.Application.TransferModels.User;

public class UserListResponseDTO
{
    public List<Guid> Ids { get; set; } = new List<Guid>();
}