namespace SpekLaiku.Api.Services;

/// <summary>
/// One scheduled activity of a checked plan (feature 012 data-model.md PlanCheckEntry): its saved date, times and
/// name, whether it has started, the latest weather at its start hour and its problems. <see cref="Weather"/> is
/// <c>null</c> and <see cref="Problems"/> is empty when <see cref="Past"/>.
/// </summary>
public sealed record PlanCheckEntry(
    DateOnly Date,
    TimeOnly StartTime,
    TimeOnly EndTime,
    string ActivityName,
    bool Past,
    WeatherSnapshot? Weather,
    IReadOnlyList<PlanProblem> Problems);
