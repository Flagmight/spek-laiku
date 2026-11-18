namespace SpekLaiku.Api.Services;

/// <summary>
/// One activity that could not be assigned a slot: either no place was found in its category or every
/// suitable period on every date overlapped an already-occupied slot (spec FR-006, FR-036).
/// </summary>
/// <remarks>
/// Stored as JSON in saved plans (feature 010 research section 4); do not rename members without a data
/// migration.
/// </remarks>
public sealed record UnscheduledActivity(string ActivityName, UnscheduledReason Reason);
