using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The categories for planning and the check of the plan's activities (research sections 1, 4 and 5).
/// A technical failure is not caught here: it reaches ApiExceptionHandler, which logs it and answers 500.
/// </summary>
public sealed class PlanActivityService(ApplicationDbContext context, ActivityCategoryService categoryService)
{
    /// <summary>Uses the category list as it is, so the order rule stays in one place.</summary>
    public Task<IReadOnlyList<ActivityCategory>> ListCategoriesAsync(CancellationToken cancellationToken) =>
        categoryService.ListAsync(cancellationToken);

    /// <summary>Reads the requested categories in one query, after the count check has bounded the work.</summary>
    public async Task<PlanActivitiesResult> CheckAsync(
        PlanActivitiesCheckRequest request,
        CancellationToken cancellationToken)
    {
        if (!PlanActivityValidator.HasValidCount(request, out var countError))
        {
            return PlanActivitiesResult.Invalid([countError!.Value]);
        }

        // "?." because a JSON list can contain null, which the validator reports.
        var ids = request.Activities!.Select(activity => activity?.CategoryId).OfType<Guid>().Distinct().ToList();
        var categories = await context.ActivityCategories
            .AsNoTracking()
            .Where(category => ids.Contains(category.Id))
            .Select(category => new ActivityCategory { Id = category.Id, Name = category.Name, Type = category.Type })
            .ToDictionaryAsync(category => category.Id, cancellationToken);

        return PlanActivityValidator.Validate(request, categories);
    }
}
