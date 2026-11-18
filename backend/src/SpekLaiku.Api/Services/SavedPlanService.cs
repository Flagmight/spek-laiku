using Microsoft.EntityFrameworkCore;
using Npgsql;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Saves a remembered generated schedule as a plan of the signed-in user (feature 010 spec FR-001 to FR-005,
/// FR-013). The plan is a copy of the snapshot the server generated, never of browser values. Saving the same
/// generated schedule again returns the existing plan instead of a second one, including when two requests race
/// past the first check (research section 6).
/// </summary>
public sealed class SavedPlanService(
    ApplicationDbContext context,
    GeneratedScheduleService generatedSchedules,
    TimeProvider timeProvider)
{
    private const string GeneratedScheduleIndex = "IX_SavedPlans_GeneratedScheduleId";

    private static readonly KeyValuePair<string, string> Expired =
        new(SavedPlanValidator.ScheduleKey, SavedPlanValidator.ScheduleExpiredMessage);

    public async Task<SavePlanResult> SaveAsync(
        string ownerId,
        SavePlanRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new List<KeyValuePair<string, string>>();
        var (name, nameError) = SavedPlanValidator.CheckName(request.Name);
        if (nameError is { } error)
        {
            errors.Add(error);
        }

        if (request.GeneratedScheduleId is not { } scheduleId)
        {
            errors.Add(Expired);
            return SavePlanResult.Invalid(errors);
        }

        var existing = await FindSavedAsync(scheduleId, cancellationToken);
        if (existing is not null)
        {
            if (existing.OwnerId != ownerId)
            {
                errors.Add(Expired);
            }

            return errors.Count == 0 ? SavePlanResult.AlreadySaved(existing) : SavePlanResult.Invalid(errors);
        }

        var snapshot = await generatedSchedules.FindAsync(scheduleId, cancellationToken);
        if (snapshot is null)
        {
            errors.Add(Expired);
        }
        else if (snapshot.Schedule.Scheduled.Count == 0)
        {
            errors.Add(new(SavedPlanValidator.ScheduleKey, SavedPlanValidator.NothingToSaveMessage));
        }

        if (errors.Count > 0)
        {
            return SavePlanResult.Invalid(errors);
        }

        return await InsertAsync(ownerId, name!, scheduleId, snapshot!, cancellationToken);
    }

    /// <summary>
    /// The user's plans, newest saved first (ties by id, so the order is stable), without their stored schedules
    /// (spec FR-009, research section 5).
    /// </summary>
    public async Task<IReadOnlyList<SavedPlanSummary>> ListAsync(string ownerId, CancellationToken cancellationToken) =>
        await context.SavedPlans
            .AsNoTracking()
            .Where(plan => plan.OwnerId == ownerId)
            .OrderByDescending(plan => plan.SavedAtUtc)
            .ThenBy(plan => plan.Id)
            .Select(plan => new SavedPlanSummary(plan.Id, plan.Name, plan.LocationName, plan.Dates, plan.SavedAtUtc))
            .ToListAsync(cancellationToken);

    private async Task<SavePlanResult> InsertAsync(
        string ownerId,
        string name,
        Guid scheduleId,
        PlanSnapshot snapshot,
        CancellationToken cancellationToken)
    {
        var plan = new SavedPlan
        {
            Id = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = name,
            SavedAtUtc = timeProvider.GetUtcNow().UtcDateTime,
            LocationName = snapshot.Setup.Location.Name,
            Dates = snapshot.Setup.Dates.ToList(),
            GeneratedScheduleId = scheduleId,
            Snapshot = snapshot
        };
        context.SavedPlans.Add(plan);

        try
        {
            await context.SaveChangesAsync(cancellationToken);
            return SavePlanResult.Created(plan);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: GeneratedScheduleIndex
        })
        {
            // Another request saved this generated schedule after the check above.
            context.Entry(plan).State = EntityState.Detached;
            var winner = await FindSavedAsync(scheduleId, cancellationToken);
            return winner is not null && winner.OwnerId == ownerId
                ? SavePlanResult.AlreadySaved(winner)
                : SavePlanResult.Invalid([Expired]);
        }
    }

    private Task<SavedPlan?> FindSavedAsync(Guid scheduleId, CancellationToken cancellationToken) =>
        context.SavedPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(plan => plan.GeneratedScheduleId == scheduleId, cancellationToken);
}
