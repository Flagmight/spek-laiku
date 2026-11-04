namespace SpekLaiku.Api.Services;

/// <summary>
/// What <see cref="PlanSetupValidator"/> found: the errors in contract order, and the values the check
/// keeps when there are none (distinct dates in ascending order, distance with 30 for <c>null</c>).
/// </summary>
public sealed record PlanSetupValidationResult(
    IReadOnlyList<KeyValuePair<string, string>> Errors,
    IReadOnlyList<DateOnly> Dates,
    int MaxTravelDistanceKm)
{
    public bool IsValid => Errors.Count == 0;
}
