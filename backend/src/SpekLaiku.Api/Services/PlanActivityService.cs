using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>The categories for planning (research section 1).</summary>
public sealed class PlanActivityService(ActivityCategoryService categoryService)
{
    /// <summary>Uses the category list as it is, so the order rule stays in one place.</summary>
    public Task<IReadOnlyList<ActivityCategory>> ListCategoriesAsync(CancellationToken cancellationToken) =>
        categoryService.ListAsync(cancellationToken);
}
