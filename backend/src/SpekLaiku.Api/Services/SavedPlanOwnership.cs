using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The ownership check every change to a saved plan starts with (feature 011 spec FR-015, research section 8),
/// shared by <see cref="SavedPlanChangeService"/> and <see cref="SavedPlanEditService"/>.
/// </summary>
public static class SavedPlanOwnership
{
    /// <summary>
    /// The plan, tracked so it can be changed, when it exists and belongs to the caller; otherwise the refusal:
    /// not found, or forbidden for another user's plan, with no plan data.
    /// </summary>
    public static async Task<(SavedPlan? Plan, SavedPlanChange? Refusal)> FindOwnedAsync(
        ApplicationDbContext context,
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
