using InternshipHoursTracker.Models;
using InternshipHoursTracker.Services;
using Microsoft.AspNetCore.Mvc;

namespace InternshipHoursTracker.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TimeLogsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;

    public TimeLogsController(MongoDbService mongoDbService)
    {
        _mongoDbService = mongoDbService;
    }

    // GET: api/timelogs
    [HttpGet]
    public async Task<ActionResult<List<TimeLog>>> GetAll()
    {
        var logs = await _mongoDbService.GetTimeLogsAsync();
        return Ok(logs);
    }

    // GET: api/timelogs/{id}
    [HttpGet("{id:length(24)}")]
    public async Task<ActionResult<TimeLog>> GetById(string id)
    {
        var log = await _mongoDbService.GetTimeLogByIdAsync(id);
        if (log is null)
            return NotFound(new { message = "Time log not found." });

        return Ok(log);
    }

    // GET: api/timelogs/user/{userId}
    [HttpGet("user/{userId:length(24)}")]
    public async Task<ActionResult<List<TimeLog>>> GetByUserId(string userId)
    {
        var logs = await _mongoDbService.GetTimeLogsByUserIdAsync(userId);
        return Ok(logs);
    }

    // GET: api/timelogs/user/{userId}/summary
    [HttpGet("user/{userId:length(24)}/summary")]
    public async Task<ActionResult> GetUserProgressSummary(string userId)
    {
        var user = await _mongoDbService.GetUserByIdAsync(userId);
        if (user is null)
            return NotFound(new { message = "User not found." });

        var logs = await _mongoDbService.GetTimeLogsByUserIdAsync(userId);
        var activeLog = logs.FirstOrDefault(l => l.TimeOut == null);

        double totalHoursLogged = Math.Round(logs.Sum(l => l.HoursLogged), 2);
        double remainingHours = Math.Round(Math.Max(0, user.TargetHours - totalHoursLogged), 2);
        double remainingDays = Math.Round(remainingHours / 8.0, 1);
        double completedDays = Math.Round(totalHoursLogged / 8.0, 1);
        double progressPercentage = user.TargetHours > 0
            ? Math.Round(Math.Min(100, (totalHoursLogged / user.TargetHours) * 100), 2)
            : 0;

        return Ok(new
        {
            userId = user.Id,
            username = user.Username,
            targetHours = user.TargetHours,
            totalHoursLogged,
            remainingHours,
            remainingDays,
            completedDays,
            progressPercentage,
            isCurrentlyClockedIn = activeLog is not null,
            activeTimeLog = activeLog,
            totalSessions = logs.Count
        });
    }

    private static double CalculateHours(DateTime timeIn, DateTime timeOut, bool deductLunch)
    {
        double rawHours = (timeOut - timeIn).TotalHours;
        if (deductLunch)
        {
            rawHours -= 1.0;
        }
        return Math.Round(Math.Max(0, rawHours), 2);
    }

    // POST: api/timelogs/time-in/{userId}
    [HttpPost("time-in/{userId:length(24)}")]
    public async Task<ActionResult<TimeLog>> TimeIn(string userId, [FromQuery] string? sessionType = null)
    {
        var user = await _mongoDbService.GetUserByIdAsync(userId);
        if (user is null)
            return NotFound(new { message = "User not found." });

        var activeLog = await _mongoDbService.GetActiveTimeLogByUserIdAsync(userId);
        if (activeLog is not null)
            return BadRequest(new { message = "User is already clocked in.", activeLog });

        var now = DateTime.UtcNow;
        var newLog = new TimeLog
        {
            UserId = userId,
            TimeIn = now,
            TimeOut = null,
            DeductLunchBreak = false,
            SessionType = sessionType ?? (now.ToLocalTime().Hour < 12 ? "Morning (AM)" : "Afternoon (PM)"),
            HoursLogged = 0
        };

        await _mongoDbService.CreateTimeLogAsync(newLog);
        return CreatedAtAction(nameof(GetById), new { id = newLog.Id }, newLog);
    }

    // POST: api/timelogs/time-out/{userId}
    [HttpPost("time-out/{userId:length(24)}")]
    public async Task<ActionResult<TimeLog>> TimeOut(string userId, [FromQuery] bool deductLunch = false)
    {
        var activeLog = await _mongoDbService.GetActiveTimeLogByUserIdAsync(userId);
        if (activeLog is null || activeLog.Id is null)
            return BadRequest(new { message = "No active time-in session found for this user." });

        activeLog.TimeOut = DateTime.UtcNow;
        activeLog.DeductLunchBreak = deductLunch;
        activeLog.HoursLogged = CalculateHours(activeLog.TimeIn, activeLog.TimeOut.Value, deductLunch);

        await _mongoDbService.UpdateTimeLogAsync(activeLog.Id, activeLog);
        return Ok(activeLog);
    }

    // POST: api/timelogs (Manual entry)
    [HttpPost]
    public async Task<ActionResult<TimeLog>> CreateManual([FromBody] TimeLog newTimeLog)
    {
        if (newTimeLog.TimeOut.HasValue)
        {
            newTimeLog.HoursLogged = CalculateHours(
                newTimeLog.TimeIn,
                newTimeLog.TimeOut.Value,
                newTimeLog.DeductLunchBreak);
        }

        if (string.IsNullOrWhiteSpace(newTimeLog.SessionType))
        {
            newTimeLog.SessionType = newTimeLog.DeductLunchBreak ? "Full Day (-1h Lunch)" : "Session";
        }

        await _mongoDbService.CreateTimeLogAsync(newTimeLog);
        return CreatedAtAction(nameof(GetById), new { id = newTimeLog.Id }, newTimeLog);
    }

    // PUT: api/timelogs/{id}
    [HttpPut("{id:length(24)}")]
    public async Task<IActionResult> Update(string id, [FromBody] TimeLog updatedTimeLog)
    {
        var existingLog = await _mongoDbService.GetTimeLogByIdAsync(id);
        if (existingLog is null)
            return NotFound(new { message = "Time log not found." });

        updatedTimeLog.Id = existingLog.Id;

        if (updatedTimeLog.TimeOut.HasValue)
        {
            updatedTimeLog.HoursLogged = CalculateHours(
                updatedTimeLog.TimeIn,
                updatedTimeLog.TimeOut.Value,
                updatedTimeLog.DeductLunchBreak);
        }

        await _mongoDbService.UpdateTimeLogAsync(id, updatedTimeLog);
        return NoContent();
    }

    // DELETE: api/timelogs/{id}
    [HttpDelete("{id:length(24)}")]
    public async Task<IActionResult> Delete(string id)
    {
        var existingLog = await _mongoDbService.GetTimeLogByIdAsync(id);
        if (existingLog is null)
            return NotFound(new { message = "Time log not found." });

        await _mongoDbService.DeleteTimeLogAsync(id);
        return NoContent();
    }
}

