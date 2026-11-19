using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Copying and deleting an existing saved plan, only by its owner (feature 011 spec FR-001, FR-004, FR-015,
/// research sections 7 and 8). Every operation checks ownership first through <see cref="SavedPlanOwnership"/>;
/// another user's plan is refused with no plan data and nothing changed. Editing in place is in
/// <see cref="SavedPlanEditService"/>.
/// </summary>
public sealed class SavedPlanChangeService(ApplicationDbContext context, TimeProvider timeProvider)
{
    /// <summary>
    /// Copies the plan as a new plan of the same owner (spec FR-004 to FR-006, FR-016). The copy keeps the
    /// original's saved time, because it holds the same schedule made with that forecast (clarification Q3); its
    /// creation time is now, so it is listed directly above the original. The owner never comes from the request.
    /// </summary>
    public async Task<SavedPlanChange> DuplicateAsync(string ownerId, Guid id, CancellationToken cancellationToken)
    {
        var (original, refusal) = await SavedPlanOwnership.FindOwnedAsync(context, ownerId, id, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        var copy = new SavedPlan
        {
            Id = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = SavedPlanValidator.CopyName(original!.Name),
            SavedAtUtc = original.SavedAtUtc,
            CreatedAtUtc = timeProvider.GetUtcNow().UtcDateTime,
            LocationName = original.LocationName,
            Dates = [.. original.Dates],
            GeneratedScheduleId = null,
            // An immutable record stored as jsonb, so the copy can share the instance.
            Snapshot = original.Snapshot
        };
        context.SavedPlans.Add(copy);
        await context.SaveChangesAsync(cancellationToken);
        return SavedPlanChange.Changed(copy);
    }

    /// <summary>
    /// Deletes the plan permanently (spec FR-001). A plan another request deleted first counts as not found.
    /// </summary>
    public async Task<SavedPlanChange> DeleteAsync(string ownerId, Guid id, CancellationToken cancellationToken)
    {
        var (plan, refusal) = await SavedPlanOwnership.FindOwnedAsync(context, ownerId, id, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        context.SavedPlans.Remove(plan!);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
            return SavedPlanChange.Deleted;
        }
        catch (DbUpdateConcurrencyException)
        {
            return SavedPlanChange.NotFound;
        }
    }
}
