using InternshipHoursTracker.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace InternshipHoursTracker.Services;

public class MongoDbService
{
    private readonly IMongoCollection<User> _usersCollection;
    private readonly IMongoCollection<TimeLog> _timeLogsCollection;

    public MongoDbService(IOptions<MongoDBSettings> mongoDBSettings)
    {
        var mongoClient = new MongoClient(mongoDBSettings.Value.ConnectionString);
        var mongoDatabase = mongoClient.GetDatabase(mongoDBSettings.Value.DatabaseName);

        _usersCollection = mongoDatabase.GetCollection<User>(mongoDBSettings.Value.UsersCollectionName);
        _timeLogsCollection = mongoDatabase.GetCollection<TimeLog>(mongoDBSettings.Value.TimeLogsCollectionName);
    }

    // ==========================================
    // USERS CRUD
    // ==========================================

    public async Task<List<User>> GetUsersAsync() =>
        await _usersCollection.Find(_ => true).ToListAsync();

    public async Task<User?> GetUserByIdAsync(string id) =>
        await _usersCollection.Find(u => u.Id == id).FirstOrDefaultAsync();

    public async Task<User?> GetUserByUsernameAsync(string username) =>
        await _usersCollection.Find(u => u.Username == username).FirstOrDefaultAsync();

    public async Task CreateUserAsync(User newUser) =>
        await _usersCollection.InsertOneAsync(newUser);

    public async Task UpdateUserAsync(string id, User updatedUser) =>
        await _usersCollection.ReplaceOneAsync(u => u.Id == id, updatedUser);

    public async Task DeleteUserAsync(string id) =>
        await _usersCollection.DeleteOneAsync(u => u.Id == id);

    // ==========================================
    // TIMELOGS CRUD
    // ==========================================

    public async Task<List<TimeLog>> GetTimeLogsAsync() =>
        await _timeLogsCollection.Find(_ => true).ToListAsync();

    public async Task<List<TimeLog>> GetTimeLogsByUserIdAsync(string userId) =>
        await _timeLogsCollection.Find(t => t.UserId == userId)
            .SortByDescending(t => t.TimeIn)
            .ToListAsync();

    public async Task<TimeLog?> GetActiveTimeLogByUserIdAsync(string userId) =>
        await _timeLogsCollection.Find(t => t.UserId == userId && t.TimeOut == null)
            .FirstOrDefaultAsync();

    public async Task<TimeLog?> GetTimeLogByIdAsync(string id) =>
        await _timeLogsCollection.Find(t => t.Id == id).FirstOrDefaultAsync();

    public async Task CreateTimeLogAsync(TimeLog newTimeLog) =>
        await _timeLogsCollection.InsertOneAsync(newTimeLog);

    public async Task UpdateTimeLogAsync(string id, TimeLog updatedTimeLog) =>
        await _timeLogsCollection.ReplaceOneAsync(t => t.Id == id, updatedTimeLog);

    public async Task DeleteTimeLogAsync(string id) =>
        await _timeLogsCollection.DeleteOneAsync(t => t.Id == id);
}

