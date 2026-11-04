namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>
/// What the page sends on Continue (contracts/plan-setup-api.md). Only the place id is sent: its name,
/// area and position always come from the location search service (spec FR-012). The distance is
/// <c>decimal?</c> so that 12.5 gets the field message instead of a general request error
/// (research section 9); <c>null</c> means the default of 30.
/// </summary>
public sealed record PlanSetupCheckRequest(long? LocationId, List<DateOnly>? Dates, decimal? MaxTravelDistanceKm);
