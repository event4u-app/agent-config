using Api.Models;

namespace Api.Services;

public interface IUserService
{
    User Find(int id);
}

public class UserService : IUserService
{
    public User Find(int id) => new User();
}
