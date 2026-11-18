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
public sealed class GeneratedScheduleService(ApplicationDbContext context, TimeProvider timeProvider)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

    public async Task<Guid> RememberAsync(PlanSnapshot snapshot, CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        await context.GeneratedSchedules
            .Where(schedule => schedule.ExpiresAtUtc <= now)
            .ExecuteDeleteAsync(cancellationToken);

        var generated = new GeneratedSchedule
        {
            Id = Guid.NewGuid(),
            CreatedAtUtc = now,
            ExpiresAtUtc = now + Lifetime,
            Snapshot = snapshot
        };
        context.GeneratedSchedules.Add(generated);
        await context.SaveChangesAsync(cancellationToken);

        return generated.Id;
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
