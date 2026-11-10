namespace SpekLaiku.Api.Services;

/// <summary>
/// A run of consecutive suitable hours for one activity on one date. <see cref="ShorterThanDuration"/> marks
/// a run the activity does not fit into (spec FR-021, Clarifications); a run exactly as long is not marked.
/// </summary>
public sealed record SuitablePeriod(TimeOnly Start, TimeOnly End, int LengthHours, bool ShorterThanDuration);
