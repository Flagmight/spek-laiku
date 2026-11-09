namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>The checked activities in request order (contracts/plan-activities-api.md).</summary>
public sealed record CheckedPlanActivitiesResponse(IReadOnlyList<CheckedPlanActivityResponse> Activities);
