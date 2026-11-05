namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// The date limits the page uses for the date picker and its checks (spec FR-010): the forecast period
/// (written as yyyy-MM-dd) and the maximum number of dates. The page computes no dates itself.
/// </summary>
public sealed record PlanPeriodResponse(DateOnly FirstDate, DateOnly LastDate, int MaxDates);
