namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// The places for a plan (contracts/plan-places-api.md): <c>updatedAt</c> is "HH:mm" in Lithuanian time,
/// <c>radiusKm</c> the search radius, and one entry per distinct category of the request.
/// </summary>
public sealed record PlanPlacesResponse(
    string UpdatedAt,
    int RadiusKm,
    IReadOnlyList<CategoryPlacesResponse> Categories);
