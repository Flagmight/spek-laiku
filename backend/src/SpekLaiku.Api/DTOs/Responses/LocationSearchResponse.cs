namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>The answer to a location search: 0 to 10 places in Lithuania.</summary>
public sealed record LocationSearchResponse(IReadOnlyList<LocationResponse> Locations);
