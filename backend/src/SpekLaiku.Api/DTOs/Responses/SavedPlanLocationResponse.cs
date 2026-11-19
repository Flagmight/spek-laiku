namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// A saved plan's location as it was saved (feature 010 contracts/plans-api.md). The id is the location search's
/// place id, which Plan Setup sends on Continue when the plan is edited (feature 011 research section 4).
/// </summary>
public sealed record SavedPlanLocationResponse(long Id, string Name, string Area, double Latitude, double Longitude);
