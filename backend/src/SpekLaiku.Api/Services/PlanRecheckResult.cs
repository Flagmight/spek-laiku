using System.Diagnostics.CodeAnalysis;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of checking a plan again before step 3 contacts a service: the checked setup and activities
/// (in request order), or the errors of the check that failed, in its order (data-model.md PlanRecheckService).
/// </summary>
public sealed record PlanRecheckResult
{
    private PlanRecheckResult()
    {
    }

    [MemberNotNullWhen(true, nameof(Setup))]
    public bool Succeeded { get; private init; }

    public CheckedPlanSetup? Setup { get; private init; }

    public IReadOnlyList<CheckedPlanActivity> Activities { get; private init; } = [];

    public IReadOnlyList<KeyValuePair<string, string>> Errors { get; private init; } = [];

    public static PlanRecheckResult Success(CheckedPlanSetup setup, IReadOnlyList<CheckedPlanActivity> activities) =>
        new() { Succeeded = true, Setup = setup, Activities = activities };

    public static PlanRecheckResult Invalid(IReadOnlyList<KeyValuePair<string, string>> errors) => new() { Errors = errors };
}
