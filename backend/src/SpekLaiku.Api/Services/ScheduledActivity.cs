namespace SpekLaiku.Api.Services;

/// <summary>
/// One activity assigned to a date and a non-overlapping time slot (the full suitable period), with its place
/// and the weather at the slot's start hour (feature 008 spec FR-003, FR-008). <see cref="CategoryId"/> is only
/// used to find the category's listed places and is never sent to the browser. <see cref="Travel"/> is
/// <c>null</c> for the first scheduled activity of its date (feature 009 spec FR-001, data-model.md).
/// </summary>
public sealed record ScheduledActivity(
    Guid CategoryId,
    string ActivityName,
    DateOnly Date,
    TimeOnly StartTime,
    TimeOnly EndTime,
    NearbyPlace Place,
    WeatherSnapshot Weather,
    TravelLeg? Travel = null);
