using System.Diagnostics.CodeAnalysis;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of a plan setup check: the checked setup, or field errors in contract order
/// (<c>locationId</c>, <c>dates</c>, <c>dates[i]</c>, <c>maxTravelDistanceKm</c>).
/// </summary>
public sealed record PlanSetupResult
{
    private PlanSetupResult()
    {
    }

    [MemberNotNullWhen(true, nameof(Setup))]
    public bool Succeeded { get; private init; }

    public CheckedPlanSetup? Setup { get; private init; }

    public IReadOnlyList<KeyValuePair<string, string>> Errors { get; private init; } = [];

    public static PlanSetupResult Success(CheckedPlanSetup setup) => new() { Succeeded = true, Setup = setup };

    public static PlanSetupResult Invalid(IReadOnlyList<KeyValuePair<string, string>> errors) => new() { Errors = errors };
}
