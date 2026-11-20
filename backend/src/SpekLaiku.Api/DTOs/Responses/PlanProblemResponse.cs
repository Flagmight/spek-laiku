namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// One broken rule of one scheduled activity (feature 012 contracts/plan-check-api.md "Problem fields"). Every
/// field is always sent; the ones the rule does not use are <c>null</c>.
/// </summary>
public sealed record PlanProblemResponse(
    string Rule,
    string? Time,
    decimal? Value,
    decimal? Limit,
    string? SunTime,
    string? OtherActivityName,
    string? OtherStartTime,
    string? OtherEndTime,
    string? FromPlaceName);
