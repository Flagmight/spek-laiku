namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// A category as planners see it. It has no place tags or version on purpose: those are for
/// administrators only, and a separate type means they cannot be sent by mistake (research section 1).
/// </summary>
public sealed record PlanCategoryResponse(
    Guid Id,
    string Name,
    string Type,
    decimal DefaultDurationHours,
    bool RequiresDaylight,
    decimal? MaxWindMs,
    decimal? MaxRainMmPerHour,
    decimal? MinTemperatureC,
    decimal? MaxTemperatureC);
