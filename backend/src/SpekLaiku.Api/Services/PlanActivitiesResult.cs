namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of checking the plan's activities: the checked activities in request order, or field
/// errors in the order given in data-model.md (Validation rules).
/// </summary>
public sealed record PlanActivitiesResult
{
    private PlanActivitiesResult()
    {
    }

    public bool Succeeded { get; private init; }

    public IReadOnlyList<CheckedPlanActivity> Activities { get; private init; } = [];

    public IReadOnlyList<KeyValuePair<string, string>> Errors { get; private init; } = [];

    public static PlanActivitiesResult Success(IReadOnlyList<CheckedPlanActivity> activities) =>
        new() { Succeeded = true, Activities = activities };

    public static PlanActivitiesResult Invalid(IReadOnlyList<KeyValuePair<string, string>> errors) =>
        new() { Errors = errors };
}
