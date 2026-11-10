namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// The forecast for a plan (contracts/plan-forecast-api.md). Times are "HH:mm" in Lithuanian time and dates
/// "yyyy-MM-dd". <see cref="Activities"/> is in request order, and each activity's hours line up with
/// <see cref="Days"/>.
/// </summary>
public sealed record PlanForecastResponse(
    string UpdatedAt,
    IReadOnlyList<ForecastDayResponse> Days,
    IReadOnlyList<ActivityForecastResponse> Activities);
