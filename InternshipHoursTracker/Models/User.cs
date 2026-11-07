using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace InternshipHoursTracker.Models;

public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string Username { get; set; } = null!;

    public string Password { get; set; } = null!;

    public double TargetHours { get; set; } = 400;
}

