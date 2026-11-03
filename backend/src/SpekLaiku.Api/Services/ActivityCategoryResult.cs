using System.Diagnostics.CodeAnalysis;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of saving a category: success, field errors keyed by request field name in form order,
/// no category with that id, or a change by someone else since the form was opened (spec FR-026).
/// </summary>
public sealed record ActivityCategoryResult
{
    private static readonly IReadOnlyDictionary<string, string> NoErrors = new Dictionary<string, string>();

    private ActivityCategoryResult()
    {
    }

    [MemberNotNullWhen(true, nameof(Category))]
    public bool Succeeded { get; private init; }

    public bool IsNotFound { get; private init; }

    public bool IsConflict { get; private init; }

    public IReadOnlyDictionary<string, string> Errors { get; private init; } = NoErrors;

    /// <summary>The saved category, so the caller can return it.</summary>
    public ActivityCategory? Category { get; private init; }

    public static ActivityCategoryResult Success(ActivityCategory category) =>
        new() { Succeeded = true, Category = category };

    public static ActivityCategoryResult Invalid(IReadOnlyDictionary<string, string> errors) => new() { Errors = errors };

    public static ActivityCategoryResult NotFound() => new() { IsNotFound = true };

    public static ActivityCategoryResult Conflict() => new() { IsConflict = true };
}
