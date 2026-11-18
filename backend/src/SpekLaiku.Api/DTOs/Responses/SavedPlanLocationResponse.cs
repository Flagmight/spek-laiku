namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>A saved plan's location as it was saved (feature 010 contracts/plans-api.md).</summary>
public sealed record SavedPlanLocationResponse(string Name, string Area, double Latitude, double Longitude);
