namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>Whether one hour suits the activity, with every reason against it ready to show.</summary>
public sealed record HourSuitabilityResponse(string Start, bool Suitable, IReadOnlyList<string> Reasons);
