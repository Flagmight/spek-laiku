namespace SpekLaiku.Api.DTOs.Responses;

public sealed record TravelLegResponse(string FromPlaceName, decimal DistanceKm, bool OverLimit);
