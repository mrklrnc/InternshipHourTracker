using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using InternshipHoursTracker.Models;
using InternshipHoursTracker.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InternshipHoursTracker.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly EmailService _emailService;
    private readonly IConfiguration _configuration;

    public UsersController(
        MongoDbService mongoDbService,
        EmailService emailService,
        IConfiguration configuration)
    {
        _mongoDbService = mongoDbService;
        _emailService = emailService;
        _configuration = configuration;
    }

    private static string GenerateSixDigitCode() =>
        RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

    private void AttachJwtToken(User user)
    {
        if (string.IsNullOrEmpty(user.Id)) return;

        string secret = _configuration["JwtSettings:SecretKey"]
            ?? "InternshipHoursTracker_SuperSecretProductionKey_2026!";
        string issuer = _configuration["JwtSettings:Issuer"] ?? "InternshipHoursTrackerAPI";
        string audience = _configuration["JwtSettings:Audience"] ?? "InternshipHoursTrackerClient";

        user.Token = JwtHelper.GenerateToken(user.Id, user.Username, secret, issuer, audience);
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
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult> Register([FromBody] User newUser)
    {
        var existingUser = await _mongoDbService.GetUserByUsernameAsync(newUser.Username);
        if (existingUser is not null)
            return Conflict(new { message = "Username already exists." });

        if (!string.IsNullOrWhiteSpace(newUser.Email))
        {
            var existingEmail = await _mongoDbService.GetUserByEmailAsync(newUser.Email);
            if (existingEmail is not null)
                return Conflict(new { message = "Email address is already registered." });
        }

        if (newUser.TargetHours <= 0)
            newUser.TargetHours = 400;

        string code = GenerateSixDigitCode();
        newUser.IsEmailVerified = false;
        newUser.VerificationCode = code;
        newUser.VerificationCodeExpiry = DateTime.UtcNow.AddMinutes(10);

        await _mongoDbService.CreateUserAsync(newUser);

        bool emailSent = false;
        if (!string.IsNullOrWhiteSpace(newUser.Email))
        {
            emailSent = await _emailService.SendVerificationEmailAsync(
                newUser.Email,
                newUser.FullName ?? newUser.Username,
                code);
        }

        return CreatedAtAction(nameof(GetById), new { id = newUser.Id }, new
        {
            requiresVerification = true,
            emailSent,
            email = newUser.Email,
            username = newUser.Username,
            message = emailSent
                ? $"A 6-digit verification code has been sent to {newUser.Email}. Please also check your Spam or Promotions folder."
                : "Account created. Please check Brevo API configuration to send verification emails."
        });
    }

    // POST: api/users/verify-email
    [HttpPost("verify-email")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult<User>> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        var user = await _mongoDbService.GetUserByEmailAsync(request.Email)
                   ?? await _mongoDbService.GetUserByUsernameAsync(request.Email);

        if (user is null || user.Id is null)
            return NotFound(new { message = "Account not found." });

        if (user.VerificationCode != request.Code.Trim())
            return BadRequest(new { message = "Invalid verification code." });

        if (user.VerificationCodeExpiry.HasValue && user.VerificationCodeExpiry.Value < DateTime.UtcNow)
            return BadRequest(new { message = "Verification code has expired. Please request a new code." });

        user.IsEmailVerified = true;
        user.VerificationCode = null;
        user.VerificationCodeExpiry = null;

        await _mongoDbService.UpdateUserAsync(user.Id, user);
        AttachJwtToken(user);
        return Ok(user);
    }

    // POST: api/users/resend-verification
    [HttpPost("resend-verification")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult> ResendVerification([FromBody] ResendVerificationRequest request)
    {
        var user = await _mongoDbService.GetUserByEmailAsync(request.Email)
                   ?? await _mongoDbService.GetUserByUsernameAsync(request.Email);

        if (user is null || user.Id is null || string.IsNullOrWhiteSpace(user.Email))
            return NotFound(new { message = "User or email address not found." });

        string code = GenerateSixDigitCode();
        user.VerificationCode = code;
        user.VerificationCodeExpiry = DateTime.UtcNow.AddMinutes(10);
        await _mongoDbService.UpdateUserAsync(user.Id, user);

        bool sent = await _emailService.SendVerificationEmailAsync(
            user.Email,
            user.FullName ?? user.Username,
            code);

        if (!sent)
            return StatusCode(500, new { message = "Failed to send verification email via Brevo. Check your Brevo API Key." });

        return Ok(new { message = $"A new 6-digit verification code was sent to {user.Email}. Please also check your Spam or Promotions folder." });
    }

    // POST: api/users/login
    [HttpPost("login")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _mongoDbService.GetUserByUsernameAsync(request.Username)
                   ?? await _mongoDbService.GetUserByEmailAsync(request.Username);

        if (user is null || user.Password != request.Password)
            return Unauthorized(new { message = "Invalid username or password." });

        if (!user.IsEmailVerified && !string.IsNullOrWhiteSpace(user.VerificationCode))
        {
            return StatusCode(403, new
            {
                requiresVerification = true,
                email = user.Email,
                username = user.Username,
                message = "Please verify your email address before signing in."
            });
        }

        AttachJwtToken(user);
        return Ok(user);
    }

    // POST: api/users/forgot-password
    [HttpPost("forgot-password")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var user = await _mongoDbService.GetUserByEmailAsync(request.EmailOrUsername)
                   ?? await _mongoDbService.GetUserByUsernameAsync(request.EmailOrUsername);

        if (user is null || user.Id is null)
            return NotFound(new { message = "No account found with that email or username." });

        if (string.IsNullOrWhiteSpace(user.Email))
            return BadRequest(new { message = "This account does not have an email address attached." });

        string code = GenerateSixDigitCode();
        user.PasswordResetCode = code;
        user.PasswordResetExpiry = DateTime.UtcNow.AddMinutes(10);
        await _mongoDbService.UpdateUserAsync(user.Id, user);

        bool sent = await _emailService.SendPasswordResetEmailAsync(
            user.Email,
            user.FullName ?? user.Username,
            code);

        if (!sent)
            return StatusCode(500, new { message = "Failed to send password reset email via Brevo. Check your Brevo API Key." });

        return Ok(new
        {
            email = user.Email,
            message = $"A 6-digit password reset code has been sent to {user.Email}. Please also check your Spam or Promotions folder."
        });
    }

    // POST: api/users/reset-password
    [HttpPost("reset-password")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var user = await _mongoDbService.GetUserByEmailAsync(request.EmailOrUsername)
                   ?? await _mongoDbService.GetUserByUsernameAsync(request.EmailOrUsername);

        if (user is null || user.Id is null)
            return NotFound(new { message = "Account not found." });

        if (string.IsNullOrWhiteSpace(user.PasswordResetCode) || user.PasswordResetCode != request.Code.Trim())
            return BadRequest(new { message = "Invalid password reset code." });

        if (user.PasswordResetExpiry.HasValue && user.PasswordResetExpiry.Value < DateTime.UtcNow)
            return BadRequest(new { message = "Password reset code has expired. Please request a new one." });

        user.Password = request.NewPassword;
        user.PasswordResetCode = null;
        user.PasswordResetExpiry = null;
        user.IsEmailVerified = true;

        await _mongoDbService.UpdateUserAsync(user.Id, user);
        return Ok(new { message = "Your password has been reset successfully! You can now sign in." });
    }

    // PUT: api/users/{id}
    [HttpPut("{id:length(24)}")]
    public async Task<IActionResult> Update(string id, [FromBody] User updatedUser)
    {
        var existingUser = await _mongoDbService.GetUserByIdAsync(id);
        if (existingUser is null)
            return NotFound(new { message = "User not found." });

        updatedUser.Id = existingUser.Id;
        if (string.IsNullOrWhiteSpace(updatedUser.Password))
        {
            updatedUser.Password = existingUser.Password;
        }
        updatedUser.IsEmailVerified = existingUser.IsEmailVerified;
        await _mongoDbService.UpdateUserAsync(id, updatedUser);
        AttachJwtToken(updatedUser);
        return Ok(updatedUser);
    }

    // POST: api/users/{id}/change-password
    [HttpPost("{id:length(24)}/change-password")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<IActionResult> ChangePassword(string id, [FromBody] ChangePasswordRequest request)
    {
        var existingUser = await _mongoDbService.GetUserByIdAsync(id);
        if (existingUser is null)
            return NotFound(new { message = "User not found." });

        if (existingUser.Password != request.CurrentPassword)
            return BadRequest(new { message = "Current password is incorrect." });

        existingUser.Password = request.NewPassword;
        await _mongoDbService.UpdateUserAsync(id, existingUser);
        return Ok(new { message = "Password updated successfully." });
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

    // POST: api/users/google-login
    [HttpPost("google-login")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Credential))
            return BadRequest(new { message = "Google credential token is required." });

        try
        {
            var parts = request.Credential.Split('.');
            if (parts.Length != 3)
                return BadRequest(new { message = "Invalid Google token format." });

            string payloadJson = Encoding.UTF8.GetString(Base64UrlDecode(parts[1]));
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;

            string? aud = root.TryGetProperty("aud", out var audProp) ? audProp.GetString() : null;
            long exp = root.TryGetProperty("exp", out var expProp) ? expProp.GetInt64() : 0;
            string? email = root.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
            string? name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
            string? sub = root.TryGetProperty("sub", out var subProp) ? subProp.GetString() : null;
            string? picture = root.TryGetProperty("picture", out var picProp) ? picProp.GetString() : null;

            string expectedClientId = _configuration["GoogleAuth:ClientId"]
                ?? "548680570260-m6gedf8u8itm7209atn1q6iqok6lvpj7.apps.googleusercontent.com";

            if (aud != expectedClientId)
                return BadRequest(new { message = "Google authentication failed: Client ID mismatch." });

            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp)
                return BadRequest(new { message = "Google token has expired. Please sign in again." });

            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "Google account did not provide a verified email." });

            var user = await _mongoDbService.GetUserByEmailAsync(email)
                       ?? await _mongoDbService.GetUserByUsernameAsync(email);

            if (user == null)
            {
                string baseUsername = email.Split('@')[0];
                var existingUsername = await _mongoDbService.GetUserByUsernameAsync(baseUsername);
                string username = existingUsername != null
                    ? $"{baseUsername}_{RandomNumberGenerator.GetInt32(100, 999)}"
                    : baseUsername;

                user = new User
                {
                    Email = email,
                    Username = username,
                    FullName = !string.IsNullOrWhiteSpace(name) ? name : baseUsername,
                    Password = Guid.NewGuid().ToString("N"),
                    GoogleId = sub,
                    ProfilePicture = picture,
                    IsEmailVerified = true,
                    TargetHours = 400,
                    WorkStartTime = "08:00",
                    WorkEndTime = "17:00"
                };

                await _mongoDbService.CreateUserAsync(user);
            }
            else
            {
                bool updated = false;
                if (!user.IsEmailVerified)
                {
                    user.IsEmailVerified = true;
                    user.VerificationCode = null;
                    user.VerificationCodeExpiry = null;
                    updated = true;
                }
                if (string.IsNullOrEmpty(user.GoogleId) && !string.IsNullOrWhiteSpace(sub))
                {
                    user.GoogleId = sub;
                    updated = true;
                }
                if (string.IsNullOrEmpty(user.FullName) && !string.IsNullOrWhiteSpace(name))
                {
                    user.FullName = name;
                    updated = true;
                }
                if (string.IsNullOrEmpty(user.ProfilePicture) && !string.IsNullOrWhiteSpace(picture))
                {
                    user.ProfilePicture = picture;
                    updated = true;
                }
                if (updated && user.Id != null)
                {
                    await _mongoDbService.UpdateUserAsync(user.Id, user);
                }
            }

            AttachJwtToken(user);
            return Ok(user);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Google Sign-In failed: {ex.Message}" });
        }
    }

    private static byte[] Base64UrlDecode(string input)
    {
        string base64 = input.Replace('-', '+').Replace('_', '/');
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }
        return Convert.FromBase64String(base64);
    }
}

public record LoginRequest(string Username, string Password);
public record GoogleLoginRequest(string Credential);
public record VerifyEmailRequest(string Email, string Code);
public record ResendVerificationRequest(string Email);
public record ForgotPasswordRequest(string EmailOrUsername);
public record ResetPasswordRequest(string EmailOrUsername, string Code, string NewPassword);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
