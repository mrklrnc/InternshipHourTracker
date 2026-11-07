using InternshipHoursTracker.Models;
using InternshipHoursTracker.Services;
using Microsoft.AspNetCore.Mvc;

namespace InternshipHoursTracker.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;

    public UsersController(MongoDbService mongoDbService)
    {
        _mongoDbService = mongoDbService;
    }

    // GET: api/users
    [HttpGet]
    public async Task<ActionResult<List<User>>> GetAll()
    {
        var users = await _mongoDbService.GetUsersAsync();
        return Ok(users);
    }

    // GET: api/users/{id}
    [HttpGet("{id:length(24)}")]
    public async Task<ActionResult<User>> GetById(string id)
    {
        var user = await _mongoDbService.GetUserByIdAsync(id);
        if (user is null)
            return NotFound(new { message = "User not found." });

        return Ok(user);
    }

    // POST: api/users/register
    [HttpPost("register")]
    public async Task<ActionResult<User>> Register([FromBody] User newUser)
    {
        var existingUser = await _mongoDbService.GetUserByUsernameAsync(newUser.Username);
        if (existingUser is not null)
            return Conflict(new { message = "Username already exists." });

        if (newUser.TargetHours <= 0)
            newUser.TargetHours = 400;

        await _mongoDbService.CreateUserAsync(newUser);
        return CreatedAtAction(nameof(GetById), new { id = newUser.Id }, newUser);
    }

    // POST: api/users/login
    [HttpPost("login")]
    public async Task<ActionResult<User>> Login([FromBody] LoginRequest request)
    {
        var user = await _mongoDbService.GetUserByUsernameAsync(request.Username);
        if (user is null || user.Password != request.Password)
            return Unauthorized(new { message = "Invalid username or password." });

        return Ok(user);
    }

    // PUT: api/users/{id}
    [HttpPut("{id:length(24)}")]
    public async Task<IActionResult> Update(string id, [FromBody] User updatedUser)
    {
        var existingUser = await _mongoDbService.GetUserByIdAsync(id);
        if (existingUser is null)
            return NotFound(new { message = "User not found." });

        updatedUser.Id = existingUser.Id;
        await _mongoDbService.UpdateUserAsync(id, updatedUser);
        return NoContent();
    }

    // DELETE: api/users/{id}
    [HttpDelete("{id:length(24)}")]
    public async Task<IActionResult> Delete(string id)
    {
        var existingUser = await _mongoDbService.GetUserByIdAsync(id);
        if (existingUser is null)
            return NotFound(new { message = "User not found." });

        await _mongoDbService.DeleteUserAsync(id);
        return NoContent();
    }
}

public record LoginRequest(string Username, string Password);

