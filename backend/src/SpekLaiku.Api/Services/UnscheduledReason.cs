namespace SpekLaiku.Api.Services;

/// <summary>Why an activity could not be assigned a time slot (spec FR-006, FR-036).</summary>
public enum UnscheduledReason
{
    NoPlace,
    NoSuitableTime,
}
