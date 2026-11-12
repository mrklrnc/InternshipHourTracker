using System.Security.Claims;
using InternshipHoursTracker.Models;
using InternshipHoursTracker.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

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

    // ==========================================
    // HELPER: JWT RESOURCE OWNERSHIP CHECK
    // ==========================================
    private bool IsAuthorizedOwner(string requestedUserId)
    {
        // If the request includes an authenticated JWT, strictly verify that the
        // UserId in the verified JWT matches the UserId in the route/body.
        if (User.Identity?.IsAuthenticated == true)
        {
            var jwtUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue("sub");

            return !string.IsNullOrEmpty(jwtUserId) && jwtUserId == requestedUserId;
        }

        // Allow legacy sessions that haven't refreshed their JWT yet
        return true;
    }

    // ==========================================
    // HELPER: SERVER-SIDE SHIFT DATA VALIDATION
    // ==========================================
    private static (bool IsValid, string? ErrorMessage) ValidateShiftTimestamps(DateTime timeIn, DateTime timeOut)
    {
        if (timeOut <= timeIn)
        {
            return (false, "Invalid timestamps: TimeOut must be strictly after TimeIn.");
        }

        double totalDurationHours = (timeOut - timeIn).TotalHours;
        if (totalDurationHours > 24.0)
        {
            return (false, "Invalid shift duration: Total shift duration cannot exceed 24 hours.");
        }

        return (true, null);
    }

    private static double CalculateHours(
        DateTime timeIn,
        DateTime timeOut,
        bool deductLunch,
        string? workStartTime = "08:00",
        string? workEndTime = "17:00",
        int? tzOffsetMinutes = null)
    {
        // Convert UTC timestamps into the user's local timezone (defaulting to UTC+8 / Philippines if not provided)
        var offset = TimeSpan.FromMinutes(tzOffsetMinutes.HasValue ? -tzOffsetMinutes.Value : 480);
        var localIn = timeIn.Kind == DateTimeKind.Utc ? timeIn.Add(offset) : timeIn;
        var localOut = timeOut.Kind == DateTimeKind.Utc ? timeOut.Add(offset) : timeOut;

        var effectiveIn = localIn;
        var effectiveOut = localOut;

        if (TimeSpan.TryParse(workStartTime ?? "08:00", out var scheduleStart))
        {
            var scheduledStartDateTime = localIn.Date.Add(scheduleStart);
            // If user clocked in early (e.g. 7:30 AM before 8:00 AM), count only starting from 8:00 AM
            if (effectiveIn < scheduledStartDateTime)
            {
                effectiveIn = scheduledStartDateTime;
            }
        }

        if (TimeSpan.TryParse(workEndTime ?? "17:00", out var scheduleEnd))
        {
            var scheduledEndDateTime = localOut.Date.Add(scheduleEnd);
            // Cap at official end of company shift (e.g. 5:00 PM) if same day
            if (localOut.Date == localIn.Date && effectiveOut > scheduledEndDateTime)
            {
                effectiveOut = scheduledEndDateTime;
            }
        }

        double rawHours = (effectiveOut - effectiveIn).TotalHours;
        if (deductLunch && rawHours > 0)
        {
            rawHours -= 1.0;
        }
        return Math.Round(Math.Max(0, rawHours), 2);
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

        if (!IsAuthorizedOwner(log.UserId))
            return Forbid();

        return Ok(log);
    }

    // GET: api/timelogs/user/{userId}
    [HttpGet("user/{userId:length(24)}")]
    public async Task<ActionResult<List<TimeLog>>> GetByUserId(string userId)
    {
        if (!IsAuthorizedOwner(userId))
            return Forbid();

        var logs = await _mongoDbService.GetTimeLogsByUserIdAsync(userId);
        return Ok(logs);
    }

    // GET: api/timelogs/user/{userId}/summary
    [HttpGet("user/{userId:length(24)}/summary")]
    public async Task<ActionResult> GetUserProgressSummary(string userId)
    {
        if (!IsAuthorizedOwner(userId))
            return Forbid();

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

        bool isOnLunch = activeLog is not null && activeLog.AmTimeOut is not null && activeLog.PmTimeIn is null;

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
            isOnLunch,
            activeTimeLog = activeLog,
            totalSessions = logs.Count
        });
    }

    // POST: api/timelogs/time-in/{userId}
    [HttpPost("time-in/{userId:length(24)}")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult<TimeLog>> TimeIn(string userId, [FromQuery] string? sessionType = null)
    {
        if (!IsAuthorizedOwner(userId))
            return Forbid();

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

    // POST: api/timelogs/lunch-out/{userId}
    [HttpPost("lunch-out/{userId:length(24)}")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult<TimeLog>> LunchOut(
        string userId,
        [FromQuery] int? tzOffsetMinutes = null)
    {
        if (!IsAuthorizedOwner(userId))
            return Forbid();

        var activeLog = await _mongoDbService.GetActiveTimeLogByUserIdAsync(userId);
        if (activeLog is null || activeLog.Id is null)
            return BadRequest(new { message = "No active time-in session found for this user." });

        if (activeLog.AmTimeOut.HasValue)
            return BadRequest(new { message = "User has already clocked out for lunch." });

        var now = DateTime.UtcNow;
        var (isValid, validationError) = ValidateShiftTimestamps(activeLog.TimeIn, now);
        if (!isValid)
            return BadRequest(new { message = validationError });

        activeLog.AmTimeOut = now;
        await _mongoDbService.UpdateTimeLogAsync(activeLog.Id, activeLog);
        return Ok(activeLog);
    }

    // POST: api/timelogs/lunch-in/{userId}
    [HttpPost("lunch-in/{userId:length(24)}")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult<TimeLog>> LunchIn(
        string userId,
        [FromQuery] int? tzOffsetMinutes = null)
    {
        if (!IsAuthorizedOwner(userId))
            return Forbid();

        var activeLog = await _mongoDbService.GetActiveTimeLogByUserIdAsync(userId);
        if (activeLog is null || activeLog.Id is null)
            return BadRequest(new { message = "No active time-in session found for this user." });

        if (!activeLog.AmTimeOut.HasValue)
            return BadRequest(new { message = "You must time out for lunch before timing back in." });

        if (activeLog.PmTimeIn.HasValue)
            return BadRequest(new { message = "User has already timed back in from lunch." });

        var now = DateTime.UtcNow;
        activeLog.PmTimeIn = now;
        await _mongoDbService.UpdateTimeLogAsync(activeLog.Id, activeLog);
        return Ok(activeLog);
    }

    // POST: api/timelogs/time-out/{userId}
    [HttpPost("time-out/{userId:length(24)}")]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult<TimeLog>> TimeOut(
        string userId,
        [FromQuery] bool deductLunch = false,
        [FromQuery] int? tzOffsetMinutes = null)
    {
        if (!IsAuthorizedOwner(userId))
            return Forbid();

        var activeLog = await _mongoDbService.GetActiveTimeLogByUserIdAsync(userId);
        if (activeLog is null || activeLog.Id is null)
            return BadRequest(new { message = "No active time-in session found for this user." });

        var user = await _mongoDbService.GetUserByIdAsync(userId);
        var timeOutTimestamp = DateTime.UtcNow;

        // Case 1: 4-Punch DTR (AM TimeIn/AmTimeOut + PM PmTimeIn/TimeOut)
        if (activeLog.AmTimeOut.HasValue && activeLog.PmTimeIn.HasValue)
        {
            var (isValid, validationError) = ValidateShiftTimestamps(activeLog.PmTimeIn.Value, timeOutTimestamp);
            if (!isValid)
                return BadRequest(new { message = validationError });

            activeLog.TimeOut = timeOutTimestamp;
            activeLog.DeductLunchBreak = false; // Explicitly punched lunch, no double deduction

            double morningHours = CalculateHours(
                activeLog.TimeIn,
                activeLog.AmTimeOut.Value,
                deductLunch: false,
                user?.WorkStartTime ?? "08:00",
                "12:00",
                tzOffsetMinutes);

            double afternoonHours = CalculateHours(
                activeLog.PmTimeIn.Value,
                timeOutTimestamp,
                deductLunch: false,
                "13:00",
                user?.WorkEndTime ?? "17:00",
                tzOffsetMinutes);

            activeLog.HoursLogged = Math.Round(morningHours + afternoonHours, 2);
        }
        // Case 2: User timed out for lunch and ends shift without returning in afternoon (Half Day AM)
        else if (activeLog.AmTimeOut.HasValue && !activeLog.PmTimeIn.HasValue)
        {
            activeLog.TimeOut = activeLog.AmTimeOut.Value;
            activeLog.DeductLunchBreak = false;
            activeLog.SessionType = "Half Day (AM - No Lunch)";
            activeLog.HoursLogged = CalculateHours(
                activeLog.TimeIn,
                activeLog.AmTimeOut.Value,
                deductLunch: false,
                user?.WorkStartTime ?? "08:00",
                "12:00",
                tzOffsetMinutes);
        }
        // Case 3: Standard single session (continuous, with or without auto-deducted lunch)
        else
        {
            var (isValid, validationError) = ValidateShiftTimestamps(activeLog.TimeIn, timeOutTimestamp);
            if (!isValid)
                return BadRequest(new { message = validationError });

            activeLog.TimeOut = timeOutTimestamp;
            activeLog.DeductLunchBreak = deductLunch;
            activeLog.HoursLogged = CalculateHours(
                activeLog.TimeIn,
                timeOutTimestamp,
                deductLunch,
                user?.WorkStartTime,
                user?.WorkEndTime,
                tzOffsetMinutes);
        }

        await _mongoDbService.UpdateTimeLogAsync(activeLog.Id, activeLog);
        return Ok(activeLog);
    }

    // POST: api/timelogs (Manual entry)
    [HttpPost]
    [EnableRateLimiting("StrictPolicy")]
    public async Task<ActionResult<TimeLog>> CreateManual(
        [FromBody] TimeLog newTimeLog,
        [FromQuery] int? tzOffsetMinutes = null)
    {
        if (!IsAuthorizedOwner(newTimeLog.UserId))
            return Forbid();

        var user = await _mongoDbService.GetUserByIdAsync(newTimeLog.UserId);

        if (newTimeLog.TimeOut.HasValue)
        {
            if (newTimeLog.AmTimeOut.HasValue && newTimeLog.PmTimeIn.HasValue)
            {
                var (isValidAm, valErrAm) = ValidateShiftTimestamps(newTimeLog.TimeIn, newTimeLog.AmTimeOut.Value);
                if (!isValidAm) return BadRequest(new { message = valErrAm });

                var (isValidPm, valErrPm) = ValidateShiftTimestamps(newTimeLog.PmTimeIn.Value, newTimeLog.TimeOut.Value);
                if (!isValidPm) return BadRequest(new { message = valErrPm });

                double morningHours = CalculateHours(
                    newTimeLog.TimeIn,
                    newTimeLog.AmTimeOut.Value,
                    deductLunch: false,
                    user?.WorkStartTime ?? "08:00",
                    "12:00",
                    tzOffsetMinutes);

                double afternoonHours = CalculateHours(
                    newTimeLog.PmTimeIn.Value,
                    newTimeLog.TimeOut.Value,
                    deductLunch: false,
                    "13:00",
                    user?.WorkEndTime ?? "17:00",
                    tzOffsetMinutes);

                newTimeLog.HoursLogged = Math.Round(morningHours + afternoonHours, 2);
            }
            else
            {
                var (isValid, validationError) = ValidateShiftTimestamps(newTimeLog.TimeIn, newTimeLog.TimeOut.Value);
                if (!isValid)
                    return BadRequest(new { message = validationError });

                newTimeLog.HoursLogged = CalculateHours(
                    newTimeLog.TimeIn,
                    newTimeLog.TimeOut.Value,
                    newTimeLog.DeductLunchBreak,
                    user?.WorkStartTime,
                    user?.WorkEndTime,
                    tzOffsetMinutes);
            }
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
    public async Task<IActionResult> Update(
        string id,
        [FromBody] TimeLog updatedTimeLog,
        [FromQuery] int? tzOffsetMinutes = null)
    {
        var existingLog = await _mongoDbService.GetTimeLogByIdAsync(id);
        if (existingLog is null)
            return NotFound(new { message = "Time log not found." });

        if (!IsAuthorizedOwner(existingLog.UserId))
            return Forbid();

        var user = await _mongoDbService.GetUserByIdAsync(existingLog.UserId);
        updatedTimeLog.Id = existingLog.Id;

        if (updatedTimeLog.TimeOut.HasValue)
        {
            if (updatedTimeLog.AmTimeOut.HasValue && updatedTimeLog.PmTimeIn.HasValue)
            {
                var (isValidAm, valErrAm) = ValidateShiftTimestamps(updatedTimeLog.TimeIn, updatedTimeLog.AmTimeOut.Value);
                if (!isValidAm) return BadRequest(new { message = valErrAm });

                var (isValidPm, valErrPm) = ValidateShiftTimestamps(updatedTimeLog.PmTimeIn.Value, updatedTimeLog.TimeOut.Value);
                if (!isValidPm) return BadRequest(new { message = valErrPm });

                double morningHours = CalculateHours(
                    updatedTimeLog.TimeIn,
                    updatedTimeLog.AmTimeOut.Value,
                    deductLunch: false,
                    user?.WorkStartTime ?? "08:00",
                    "12:00",
                    tzOffsetMinutes);

                double afternoonHours = CalculateHours(
                    updatedTimeLog.PmTimeIn.Value,
                    updatedTimeLog.TimeOut.Value,
                    deductLunch: false,
                    "13:00",
                    user?.WorkEndTime ?? "17:00",
                    tzOffsetMinutes);

                updatedTimeLog.HoursLogged = Math.Round(morningHours + afternoonHours, 2);
            }
            else
            {
                var (isValid, validationError) = ValidateShiftTimestamps(updatedTimeLog.TimeIn, updatedTimeLog.TimeOut.Value);
                if (!isValid)
                    return BadRequest(new { message = validationError });

                updatedTimeLog.HoursLogged = CalculateHours(
                    updatedTimeLog.TimeIn,
                    updatedTimeLog.TimeOut.Value,
                    updatedTimeLog.DeductLunchBreak,
                    user?.WorkStartTime,
                    user?.WorkEndTime,
                    tzOffsetMinutes);
            }
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

        if (!IsAuthorizedOwner(existingLog.UserId))
            return Forbid();

        await _mongoDbService.DeleteTimeLogAsync(id, existingLog.UserId);
        return NoContent();
    }
}
