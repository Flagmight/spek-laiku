using Microsoft.EntityFrameworkCore;
using Npgsql;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Editing an existing saved plan in place, only by its owner (feature 011 spec FR-010, FR-011, FR-014, FR-015):
/// saving changes from an edit, and renaming. The plan keeps its id, owner and creation time. Every operation
/// checks ownership first through <see cref="SavedPlanOwnership"/>.
/// </summary>
public sealed class SavedPlanEditService(
    ApplicationDbContext context,
    GeneratedScheduleService generatedSchedules,
    TimeProvider timeProvider)
{
    private const string GeneratedScheduleIndex = "IX_SavedPlans_GeneratedScheduleId";

    private static readonly KeyValuePair<string, string> Expired =
        new(SavedPlanValidator.ScheduleKey, SavedPlanValidator.ScheduleExpiredMessage);

    /// <summary>
    /// Replaces the plan with a schedule the server generated (research section 3). Only the generated schedule id
    /// and the name are taken from the request. A repeat with the id the plan already holds only applies the name;
    /// an id saved in another plan is refused. Name and schedule errors are returned together, and the plan is
    /// unchanged after any error.
    /// </summary>
    public async Task<SavedPlanChange> ReplaceAsync(
        string ownerId,
        Guid id,
        SavePlanRequest request,
        CancellationToken cancellationToken)
    {
        var (plan, refusal) = await SavedPlanOwnership.FindOwnedAsync(context, ownerId, id, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        var (name, nameError) = SavedPlanValidator.CheckName(request.Name);
        if (request.GeneratedScheduleId is { } repeated && repeated == plan!.GeneratedScheduleId)
        {
            return nameError is { } repeatError
                ? SavedPlanChange.Invalid([repeatError])
                : await SaveAsync(plan, () => plan.Name = name!, cancellationToken);
        }

        var errors = new List<KeyValuePair<string, string>>();
        if (nameError is { } error)
        {
            errors.Add(error);
        }

        PlanSnapshot? snapshot = null;
        if (await IsSavedInAnotherPlanAsync(request.GeneratedScheduleId, id, cancellationToken))
        {
            errors.Add(Expired);
        }
        else
        {
            (snapshot, var scheduleError) =
                await generatedSchedules.FindSavableAsync(request.GeneratedScheduleId, cancellationToken);
            if (scheduleError is { } savableError)
            {
                errors.Add(savableError);
            }
        }

        if (errors.Count > 0)
        {
            return SavedPlanChange.Invalid(errors);
        }

        return await SaveAsync(
            plan!,
            () => Replace(plan!, name!, request.GeneratedScheduleId, snapshot!),
            cancellationToken);
    }

    /// <summary>
    /// Changes only the plan's name; the schedule and the saved time stay as they are (spec FR-014). Ownership is
    /// checked before the name, so another user's or a missing plan is refused even with an invalid name.
    /// </summary>
    public async Task<SavedPlanChange> RenameAsync(
        string ownerId,
        Guid id,
        RenamePlanRequest request,
        CancellationToken cancellationToken)
    {
        var (plan, refusal) = await SavedPlanOwnership.FindOwnedAsync(context, ownerId, id, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        var (name, nameError) = SavedPlanValidator.CheckName(request.Name);
        if (nameError is { } error)
        {
            return SavedPlanChange.Invalid([error]);
        }

        plan!.Name = name!;
        await context.SaveChangesAsync(cancellationToken);
        return SavedPlanChange.Changed(plan);
    }

    private void Replace(SavedPlan plan, string name, Guid? scheduleId, PlanSnapshot snapshot)
    {
        plan.Name = name;
        plan.SavedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        plan.LocationName = snapshot.Setup.Location.Name;
        plan.Dates = [.. snapshot.Setup.Dates];
        plan.GeneratedScheduleId = scheduleId;
        plan.Snapshot = snapshot;
    }

    /// <summary>
    /// Applies the change and saves. Another request that saved the same generated schedule first breaks the
    /// unique index; that change is refused like an expired schedule, and the stored plan is left as it was.
    /// </summary>
    private async Task<SavedPlanChange> SaveAsync(
        SavedPlan plan,
        Action change,
        CancellationToken cancellationToken)
    {
        change();
        try
        {
            await context.SaveChangesAsync(cancellationToken);
            return SavedPlanChange.Changed(plan);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: GeneratedScheduleIndex
        })
        {
            return SavedPlanChange.Invalid([Expired]);
        }
    }

    private Task<bool> IsSavedInAnotherPlanAsync(Guid? scheduleId, Guid planId, CancellationToken cancellationToken) =>
        scheduleId is { } id
            ? context.SavedPlans.AnyAsync(
                plan => plan.GeneratedScheduleId == id && plan.Id != planId,
                cancellationToken)
            : Task.FromResult(false);
}
