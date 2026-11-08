using System.Threading.RateLimiting;
using InternshipHoursTracker.Models;
using InternshipHoursTracker.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// 1. DATABASE & EMAIL CONFIGURATION
// ==========================================
builder.Services.Configure<MongoDBSettings>(
    builder.Configuration.GetSection("MongoDBSettings"));

builder.Services.Configure<BrevoSettings>(
    builder.Configuration.GetSection("BrevoSettings"));

// ==========================================
// 2. IN-MEMORY CACHING & SERVICES
// ==========================================
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<MongoDbService>();
builder.Services.AddHttpClient<EmailService>();

// ==========================================
// 3. PRODUCTION CORS POLICY
// ==========================================
builder.Services.AddCors(options =>
{
    options.AddPolicy("ProductionCors", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.WithOrigins(
                    "https://internship-hour-tracker.vercel.app",
                    "http://localhost:5173",
                    "http://localhost:3000")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            policy.WithOrigins("https://internship-hour-tracker.vercel.app")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
    });
});

// ==========================================
// 4. JWT BEARER AUTHENTICATION & AUTHORIZATION
// ==========================================
builder.Services.AddAuthentication(JwtHelper.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, JwtBearerAuthHandler>(JwtHelper.SchemeName, null);

builder.Services.AddAuthorization();

// ==========================================
// 5. RATE LIMITING (10 req / minute per IP)
// ==========================================
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            message = "Too many requests. Please wait a minute before trying again."
        }, cancellationToken);
    };

    options.AddPolicy("StrictPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// ==========================================
// HTTP REQUEST PIPELINE
// ==========================================
app.MapOpenApi();

app.UseCors("ProductionCors");

app.UseRateLimiter();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Content("""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Internship Hours Tracker API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0; background: #fafafa; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi/v1.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>
""", "text/html")).ExcludeFromDescription();

app.MapControllers();

app.Run();
