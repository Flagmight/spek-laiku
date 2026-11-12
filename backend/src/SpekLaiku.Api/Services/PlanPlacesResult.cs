using System.Diagnostics.CodeAnalysis;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of a place request: the places, or the errors of the plan check (every setup key prefixed
/// <c>setup</c>, or the activity check's own <c>activities</c> keys), in their checks' order.
/// </summary>
public sealed record PlanPlacesResult
{
    private PlanPlacesResult()
    {
    }

    [MemberNotNullWhen(true, nameof(Places))]
    public bool Succeeded { get; private init; }

    public PlanPlaces? Places { get; private init; }

    public IReadOnlyList<KeyValuePair<string, string>> Errors { get; private init; } = [];

    public static PlanPlacesResult Success(PlanPlaces places) => new() { Succeeded = true, Places = places };

    public static PlanPlacesResult Invalid(IReadOnlyList<KeyValuePair<string, string>> errors) => new() { Errors = errors };
}
