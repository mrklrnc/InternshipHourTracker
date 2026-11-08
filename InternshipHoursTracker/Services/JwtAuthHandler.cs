using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace InternshipHoursTracker.Services;

public static class JwtHelper
{
    public const string SchemeName = "JwtBearer";

    public static string GenerateToken(string userId, string username, string secretKey, string issuer, string audience)
    {
        var headerJson = JsonSerializer.Serialize(new { alg = "HS256", typ = "JWT" });
        var exp = DateTimeOffset.UtcNow.AddDays(7).ToUnixTimeSeconds();
        var payloadJson = JsonSerializer.Serialize(new
        {
            sub = userId,
            nameid = userId,
            unique_name = username,
            iss = issuer,
            aud = audience,
            exp
        });

        string headerB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(headerJson));
        string payloadB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));
        string unsignedToken = $"{headerB64}.{payloadB64}";

        string signatureB64 = ComputeSignature(unsignedToken, secretKey);
        return $"{unsignedToken}.{signatureB64}";
    }

    public static ClaimsPrincipal? ValidateToken(string token, string secretKey, string validIssuer, string validAudience)
    {
        var parts = token.Split('.');
        if (parts.Length != 3) return null;

        string unsignedToken = $"{parts[0]}.{parts[1]}";
        string expectedSig = ComputeSignature(unsignedToken, secretKey);

        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(parts[2]),
                Encoding.UTF8.GetBytes(expectedSig)))
        {
            return null;
        }

        try
        {
            var payloadBytes = Base64UrlDecode(parts[1]);
            using var doc = JsonDocument.Parse(payloadBytes);
            var root = doc.RootElement;

            if (root.TryGetProperty("exp", out var expEl))
            {
                long exp = expEl.GetInt64();
                if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= exp)
                    return null;
            }

            if (root.TryGetProperty("iss", out var issEl) && issEl.GetString() != validIssuer)
                return null;

            if (root.TryGetProperty("aud", out var audEl) && audEl.GetString() != validAudience)
                return null;

            string? userId = root.TryGetProperty("sub", out var subEl) ? subEl.GetString() : null;
            string? username = root.TryGetProperty("unique_name", out var nameEl) ? nameEl.GetString() : null;

            if (string.IsNullOrEmpty(userId)) return null;

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, userId),
                new("sub", userId)
            };

            if (!string.IsNullOrEmpty(username))
            {
                claims.Add(new Claim(ClaimTypes.Name, username));
            }

            var identity = new ClaimsIdentity(claims, SchemeName);
            return new ClaimsPrincipal(identity);
        }
        catch
        {
            return null;
        }
    }

    private static string ComputeSignature(string unsignedToken, string secretKey)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secretKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(unsignedToken));
        return Base64UrlEncode(hash);
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        string padded = input.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}

public class JwtBearerAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly IConfiguration _configuration;

    public JwtBearerAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IConfiguration configuration)
        : base(options, logger, encoder)
    {
        _configuration = configuration;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authHeader = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        string token = authHeader["Bearer ".Length..].Trim();
        string secret = _configuration["JwtSettings:SecretKey"] ?? "InternshipHoursTracker_SuperSecretProductionKey_2026!";
        string issuer = _configuration["JwtSettings:Issuer"] ?? "InternshipHoursTrackerAPI";
        string audience = _configuration["JwtSettings:Audience"] ?? "InternshipHoursTrackerClient";

        var principal = JwtHelper.ValidateToken(token, secret, issuer, audience);
        if (principal is null)
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid or expired JWT token."));
        }

        var ticket = new AuthenticationTicket(principal, JwtHelper.SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

