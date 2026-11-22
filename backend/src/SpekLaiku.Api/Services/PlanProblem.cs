namespace SpekLaiku.Api.Services;

/// <summary>
/// One broken rule of one scheduled activity (feature 012 data-model.md PlanProblem). Each rule fills only its own
/// members: weather rules <see cref="Time"/>, <see cref="Value"/> and <see cref="Limit"/>; NoForecast
/// <see cref="Time"/>; daylight rules <see cref="Time"/> and <see cref="SunTime"/>; Overlap the other activity;
/// Travel <see cref="Value"/> (km), <see cref="Limit"/> (maximum km) and <see cref="FromPlaceName"/>.
/// </summary>
public sealed record PlanProblem(
    PlanRule Rule,
    TimeOnly? Time = null,
    decimal? Value = null,
    decimal? Limit = null,
    TimeOnly? SunTime = null,
    string? OtherActivityName = null,
    TimeOnly? OtherStartTime = null,
    TimeOnly? OtherEndTime = null,
    string? FromPlaceName = null);
