using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace InternshipHoursTracker.Models;

[BsonIgnoreExtraElements]
public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string Username { get; set; } = null!;

    public string? FullName { get; set; }

    public string? Email { get; set; }

    public string Password { get; set; } = null!;

    public double TargetHours { get; set; } = 400;

    public string WorkStartTime { get; set; } = "08:00";

    public string WorkEndTime { get; set; } = "17:00";

    [BsonIgnore]
    public string? Token { get; set; }

    public bool IsEmailVerified { get; set; } = false;

    public string? VerificationCode { get; set; }

    public DateTime? VerificationCodeExpiry { get; set; }

    public string? PasswordResetCode { get; set; }

    public DateTime? PasswordResetExpiry { get; set; }

    public string? GoogleId { get; set; }

    public string? ProfilePicture { get; set; }
}

