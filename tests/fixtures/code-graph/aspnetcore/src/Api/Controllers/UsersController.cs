using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : Controller
{
    private readonly IUserService _users;

    public UsersController(IUserService users, ILogger<UsersController> logger, int retries)
    {
        _users = users;
    }

    [HttpGet]
    public IActionResult Index()
    {
        return View();
    }

    [HttpGet("{id}")]
    public IActionResult Show(int id)
    {
        return View("Details", _users.Find(id));
    }

    [HttpPost]
    [Route("create")]
    public IActionResult Create(User user)
    {
        return View("Missing");
    }

    [Route("[action]")]
    public IActionResult Search()
    {
        return PartialView("_Row");
    }

    [HttpDelete("/admin/users/{id}")]
    public IActionResult Remove(int id)
    {
        return Ok();
    }

    public IActionResult Helper()
    {
        return View("Index");
    }
}
