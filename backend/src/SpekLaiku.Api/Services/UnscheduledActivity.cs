namespace SpekLaiku.Api.Services;

/// <summary>
/// One activity that could not be assigned a slot: either no place was found in its category or every
/// suitable period on every date overlapped an already-occupied slot (spec FR-006, FR-036).
/// </summary>
public sealed record UnscheduledActivity(string ActivityName, UnscheduledReason Reason);
