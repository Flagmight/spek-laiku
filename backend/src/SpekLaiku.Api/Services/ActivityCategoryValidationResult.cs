using System.Diagnostics.CodeAnalysis;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of <see cref="ActivityCategoryValidator.Validate"/>: the field errors in form order,
/// or the parsed values ready to store.
/// </summary>
public sealed record ActivityCategoryValidationResult
{
    private static readonly IReadOnlyDictionary<string, string> NoErrors = new Dictionary<string, string>();

    private ActivityCategoryValidationResult()
    {
    }

    [MemberNotNullWhen(true, nameof(Category))]
    public bool IsValid => Category is not null;

    public IReadOnlyDictionary<string, string> Errors { get; private init; } = NoErrors;

    public ValidActivityCategory? Category { get; private init; }

    public static ActivityCategoryValidationResult Valid(ValidActivityCategory category) => new() { Category = category };

    public static ActivityCategoryValidationResult Invalid(IReadOnlyDictionary<string, string> errors) =>
        new() { Errors = errors };
}

/// <summary>
/// Validated category values: the trimmed name, its normalized form, the type, and the weather
/// limits (all <c>null</c> for an Indoor category) and the normalized place tags.
/// </summary>
public sealed record ValidActivityCategory(
    string Name,
    string NormalizedName,
    ActivityType Type,
    decimal DefaultDurationHours,
    bool RequiresDaylight,
    decimal? MaxWindMs,
    decimal? MaxRainMmPerHour,
    decimal? MinTemperatureC,
    decimal? MaxTemperatureC,
    IReadOnlyList<string> PlaceTags);
