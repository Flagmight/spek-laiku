namespace SpekLaiku.Api.DTOs.Responses;

public sealed record ScheduledActivityResponse(
    string ActivityName,
    DateOnly Date,
    string StartTime,
    string EndTime,
    NearbyPlaceResponse Place,
    WeatherSnapshotResponse Weather,
    TravelLegResponse? Travel);
