namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>A run of consecutive suitable hours, marked when it is shorter than the activity's duration.</summary>
public sealed record SuitablePeriodResponse(string Start, string End, int LengthHours, bool ShorterThanDuration);
