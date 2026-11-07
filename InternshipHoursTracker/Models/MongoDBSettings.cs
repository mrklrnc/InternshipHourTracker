namespace InternshipHoursTracker.Models;

public class MongoDBSettings
{
    public string ConnectionString { get; set; } = null!;
    public string DatabaseName { get; set; } = null!;
    public string UsersCollectionName { get; set; } = null!;
    public string TimeLogsCollectionName { get; set; } = null!;
}

