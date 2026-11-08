using InternshipHoursTracker.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace InternshipHoursTracker.Services;

public class MongoDbService
{
    private readonly IMongoCollection<User> _usersCollection;
    private readonly IMongoCollection<TimeLog> _timeLogsCollection;
    private readonly IMemoryCache _cache;

    private static string GetUserLogsCacheKey(string userId) => $"timelogs_user_{userId}";

    public MongoDbService(IOptions<MongoDBSettings> mongoDBSettings, IMemoryCache cache)
    {
        var mongoClient = new MongoClient(mongoDBSettings.Value.ConnectionString);
        var mongoDatabase = mongoClient.GetDatabase(mongoDBSettings.Value.DatabaseName);

        _usersCollection = mongoDatabase.GetCollection<User>(mongoDBSettings.Value.UsersCollectionName);
        _timeLogsCollection = mongoDatabase.GetCollection<TimeLog>(mongoDBSettings.Value.TimeLogsCollectionName);
        _cache = cache;
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

    public async Task<User?> GetUserByEmailAsync(string email) =>
        await _usersCollection.Find(u => u.Email != null && u.Email.ToLower() == email.ToLower()).FirstOrDefaultAsync();

    public async Task CreateUserAsync(User newUser) =>
        await _usersCollection.InsertOneAsync(newUser);

    public async Task UpdateUserAsync(string id, User updatedUser) =>
        await _usersCollection.ReplaceOneAsync(u => u.Id == id, updatedUser);

    public async Task DeleteUserAsync(string id) =>
        await _usersCollection.DeleteOneAsync(u => u.Id == id);

    // ==========================================
    // TIMELOGS CRUD (WITH 5-MINUTE RAM CACHING)
    // ==========================================

    public async Task<List<TimeLog>> GetTimeLogsAsync() =>
        await _timeLogsCollection.Find(_ => true).ToListAsync();

    public async Task<List<TimeLog>> GetTimeLogsByUserIdAsync(string userId)
    {
        string cacheKey = GetUserLogsCacheKey(userId);

        if (_cache.TryGetValue(cacheKey, out List<TimeLog>? cachedLogs) && cachedLogs is not null)
        {
            return cachedLogs;
        }

        var logs = await _timeLogsCollection.Find(t => t.UserId == userId)
            .SortByDescending(t => t.TimeIn)
            .ToListAsync();

        var cacheOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
        };

        _cache.Set(cacheKey, logs, cacheOptions);
        return logs;
    }

    public async Task<TimeLog?> GetActiveTimeLogByUserIdAsync(string userId) =>
        await _timeLogsCollection.Find(t => t.UserId == userId && t.TimeOut == null)
            .FirstOrDefaultAsync();

    public async Task<TimeLog?> GetTimeLogByIdAsync(string id) =>
        await _timeLogsCollection.Find(t => t.Id == id).FirstOrDefaultAsync();

    public async Task CreateTimeLogAsync(TimeLog newTimeLog)
    {
        await _timeLogsCollection.InsertOneAsync(newTimeLog);
        // Cache Invalidation on Time-In / Manual Creation
        _cache.Remove(GetUserLogsCacheKey(newTimeLog.UserId));
    }

    public async Task UpdateTimeLogAsync(string id, TimeLog updatedTimeLog)
    {
        await _timeLogsCollection.ReplaceOneAsync(t => t.Id == id, updatedTimeLog);
        // Cache Invalidation on Time-Out / Edit
        _cache.Remove(GetUserLogsCacheKey(updatedTimeLog.UserId));
    }

    public async Task DeleteTimeLogAsync(string id, string? userId = null)
    {
        if (string.IsNullOrEmpty(userId))
        {
            var existing = await GetTimeLogByIdAsync(id);
            userId = existing?.UserId;
        }

        await _timeLogsCollection.DeleteOneAsync(t => t.Id == id);

        if (!string.IsNullOrEmpty(userId))
        {
            _cache.Remove(GetUserLogsCacheKey(userId));
        }
    }
}
