using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace InternshipHoursTracker.Models;

public class TimeLog
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    public DateTime TimeIn { get; set; }

    public DateTime? TimeOut { get; set; }

    public bool DeductLunchBreak { get; set; }

    public string? SessionType { get; set; } // e.g., "Morning", "Afternoon", "Full Day"

    public double HoursLogged { get; set; }
}

