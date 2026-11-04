using System.Diagnostics.CodeAnalysis;

namespace SpekLaiku.Api.Services;

/// <summary>The outcome of a location search: the places found (possibly none), or an error keyed <c>query</c>.</summary>
public sealed record LocationSearchResult
{
    private static readonly IReadOnlyDictionary<string, string> NoErrors = new Dictionary<string, string>();

    private LocationSearchResult()
    {
    }

    [MemberNotNullWhen(true, nameof(Locations))]
    public bool Succeeded { get; private init; }

    public IReadOnlyList<PlaceLocation>? Locations { get; private init; }

    public IReadOnlyDictionary<string, string> Errors { get; private init; } = NoErrors;

    public static LocationSearchResult Success(IReadOnlyList<PlaceLocation> locations) =>
        new() { Succeeded = true, Locations = locations };

    public static LocationSearchResult Invalid(IReadOnlyDictionary<string, string> errors) => new() { Errors = errors };
}
