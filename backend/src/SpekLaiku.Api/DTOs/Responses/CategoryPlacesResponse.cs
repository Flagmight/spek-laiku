namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>A category's places; an empty list means no place was found within the radius.</summary>
public sealed record CategoryPlacesResponse(Guid CategoryId, IReadOnlyList<NearbyPlaceResponse> Places);
