using System.Text;
using System.Text.Json;
using InternshipHoursTracker.Models;
using Microsoft.Extensions.Options;

namespace InternshipHoursTracker.Services;

public class EmailService
{
    private readonly HttpClient _httpClient;
    private readonly BrevoSettings _settings;
    private readonly ILogger<EmailService> _logger;

    public EmailService(
        HttpClient httpClient,
        IOptions<BrevoSettings> settings,
        ILogger<EmailService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<bool> SendVerificationEmailAsync(string toEmail, string toName, string code)
    {
        string subject = $"{code} is your Internship Hours Tracker verification code";
        string htmlContent = $$"""
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
          <h2 style="margin: 0 0 12px 0; color: #ffffff;">Verify Your Email Address</h2>
          <p style="color: #94a3b8; font-size: 15px; line-height: 1.5;">Hi <strong>{{toName}}</strong>,</p>
          <p style="color: #94a3b8; font-size: 15px; line-height: 1.5;">Use the 6-digit verification code below to activate your <strong>Internship Hours Tracker</strong> account:</p>
          <div style="background: #1e293b; border: 1px solid #3b82f6; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #60a5fa;">{{code}}</span>
          </div>
          <p style="color: #64748b; font-size: 13px;">This code expires in 10 minutes. If you did not create an account, you can safely ignore this email.</p>
        </div>
        """;

        return await SendBrevoEmailAsync(toEmail, toName, subject, htmlContent);
    }

    public async Task<bool> SendPasswordResetEmailAsync(string toEmail, string toName, string code)
    {
        string subject = $"{code} is your Internship Hours Tracker password reset code";
        string htmlContent = $$"""
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
          <h2 style="margin: 0 0 12px 0; color: #ffffff;">Password Reset Request</h2>
          <p style="color: #94a3b8; font-size: 15px; line-height: 1.5;">Hi <strong>{{toName}}</strong>,</p>
          <p style="color: #94a3b8; font-size: 15px; line-height: 1.5;">Enter the 6-digit security code below to reset your password for <strong>Internship Hours Tracker</strong>:</p>
          <div style="background: #1e293b; border: 1px solid #10b981; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #34d399;">{{code}}</span>
          </div>
          <p style="color: #64748b; font-size: 13px;">This code expires in 10 minutes. If you did not request a password reset, your account remains secure.</p>
        </div>
        """;

        return await SendBrevoEmailAsync(toEmail, toName, subject, htmlContent);
    }

    private async Task<bool> SendBrevoEmailAsync(string toEmail, string toName, string subject, string htmlContent)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey) || _settings.ApiKey.StartsWith("PASTE_"))
        {
            _logger.LogWarning("Brevo ApiKey is not configured. Email to {Email} was skipped.", toEmail);
            return false;
        }

        var payload = new
        {
            sender = new { name = _settings.SenderName, email = _settings.SenderEmail },
            to = new[] { new { email = toEmail, name = toName } },
            subject,
            htmlContent
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
        request.Headers.Add("api-key", _settings.ApiKey);
        request.Headers.Add("accept", "application/json");
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("Brevo API error ({StatusCode}): {Error}", response.StatusCode, errorBody);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email via Brevo to {Email}", toEmail);
            return false;
        }
    }
}

