namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>One scheduled activity of a checked plan (feature 012 contracts/plan-check-api.md).</summary>
public sealed record PlanCheckEntryResponse(
    DateOnly Date,
    string StartTime,
    string EndTime,
    string ActivityName,
    bool Past,
    WeatherSnapshotResponse? Weather,
    IReadOnlyList<PlanProblemResponse> Problems);
