namespace SpekLaiku.Api.Services;

/// <summary>
/// One activity assigned to a date and a non-overlapping time slot (the full suitable period), with the
/// nearest place and the weather at the slot's start hour (spec FR-003, FR-008).
/// </summary>
public sealed record ScheduledActivity(
    string ActivityName,
    DateOnly Date,
    TimeOnly StartTime,
    TimeOnly EndTime,
    NearbyPlace Place,
    WeatherSnapshot Weather);
