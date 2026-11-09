namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// The categories for planning. <c>MaxActivities</c> is sent so the page holds no copy of the limit
/// (constitution I).
/// </summary>
public sealed record PlanCategoriesResponse(IReadOnlyList<PlanCategoryResponse> Categories, int MaxActivities);
