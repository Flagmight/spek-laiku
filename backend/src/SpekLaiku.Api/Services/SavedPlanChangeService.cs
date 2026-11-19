using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Changes to an existing saved plan, only by its owner (feature 011 spec FR-015, research sections 7 and 8).
/// Every operation checks ownership first; another user's plan is refused with no plan data and nothing changed.
/// </summary>
public sealed class SavedPlanChangeService(ApplicationDbContext context)
{
    /// <summary>
    /// Deletes the plan permanently (spec FR-001). A plan another request deleted first counts as not found.
    /// </summary>
    public async Task<SavedPlanChange> DeleteAsync(string ownerId, Guid id, CancellationToken cancellationToken)
    {
        var (plan, refusal) = await FindOwnedAsync(ownerId, id, cancellationToken);
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

    /// <summary>
    /// The plan, tracked so it can be changed, when it exists and belongs to the caller; otherwise the refusal:
    /// not found, or forbidden for another user's plan.
    /// </summary>
    private async Task<(SavedPlan? Plan, SavedPlanChange? Refusal)> FindOwnedAsync(
        string ownerId,
        Guid id,
        CancellationToken cancellationToken)
    {
        var plan = await context.SavedPlans.FirstOrDefaultAsync(saved => saved.Id == id, cancellationToken);
        if (plan is null)
        {
            return (null, SavedPlanChange.NotFound);
        }

        return plan.OwnerId == ownerId ? (plan, null) : (null, SavedPlanChange.Forbidden);
    }
}
