using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Remembers each generated schedule for <see cref="Lifetime"/>, so Save stores exactly what the user saw and
/// never takes schedule values from the browser (feature 010 spec FR-004, research section 2). Expired rows are
/// deleted before each insert, so no cleanup job is needed. Ids come from <see cref="Guid.NewGuid"/>: 122
/// random bits from the operating system's secure generator. A version 7 GUID would start with a timestamp
/// and be easier to guess, and anyone holding an id can save that schedule (research section 3).
/// </summary>
public sealed class GeneratedScheduleService(
    ApplicationDbContext context,
    TimeProvider timeProvider,
    ILogger<GeneratedScheduleService> logger)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

    /// <summary>
    /// Stores the snapshot and returns its id, or <c>null</c> when the database cannot store it. The schedule is
    /// then still shown, it only cannot be saved: a failed write must not turn a computed schedule into an error.
    /// </summary>
    public async Task<Guid?> RememberAsync(PlanSnapshot snapshot, CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var generated = new GeneratedSchedule
        {
            Id = Guid.NewGuid(),
            CreatedAtUtc = now,
            ExpiresAtUtc = now + Lifetime,
            Snapshot = snapshot
        };

        try
        {
            await context.GeneratedSchedules
                .Where(schedule => schedule.ExpiresAtUtc <= now)
                .ExecuteDeleteAsync(cancellationToken);
            context.GeneratedSchedules.Add(generated);
            await context.SaveChangesAsync(cancellationToken);
            return generated.Id;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            context.Entry(generated).State = EntityState.Detached;
            // Only the kind of failure is logged, never the plan (constitution IV).
            logger.LogWarning(
                "A generated schedule could not be stored, so it cannot be saved: {ExceptionType}",
                exception.GetType().Name);
            return null;
        }
    }

    /// <summary>
    /// The remembered snapshot when it can be saved as a plan, or the <c>generatedScheduleId</c> error: "Generate
    /// the schedule again to save it." for a missing, unknown or expired id, and "There is nothing to save in this
    /// schedule." when nothing was scheduled. Shared by saving a new plan and saving changes to one (feature 011
    /// research section 3).
    /// </summary>
    public async Task<(PlanSnapshot? Snapshot, KeyValuePair<string, string>? Error)> FindSavableAsync(
        Guid? id,
        CancellationToken cancellationToken)
    {
        var snapshot = id is { } scheduleId ? await FindAsync(scheduleId, cancellationToken) : null;
        if (snapshot is null)
        {
            return (null, new(SavedPlanValidator.ScheduleKey, SavedPlanValidator.ScheduleExpiredMessage));
        }

        return snapshot.Schedule.Scheduled.Count == 0
            ? (null, new(SavedPlanValidator.ScheduleKey, SavedPlanValidator.NothingToSaveMessage))
            : (snapshot, null);
    }

    /// <summary>The remembered snapshot, or <c>null</c> when the id is unknown or its 30 minutes have passed.</summary>
    public async Task<PlanSnapshot?> FindAsync(Guid id, CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var generated = await context.GeneratedSchedules
            .AsNoTracking()
            .FirstOrDefaultAsync(schedule => schedule.Id == id, cancellationToken);

        return generated is not null && now < generated.ExpiresAtUtc ? generated.Snapshot : null;
    }
}
