using System.Diagnostics.CodeAnalysis;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>What a change to a saved plan produced (feature 011 data-model.md, "SavedPlanChange").</summary>
public enum SavedPlanChangeOutcome
{
    /// <summary>Renamed, replaced or copied; carries the plan: 200, or 201 for a copy.</summary>
    Changed,

    /// <summary>The plan was deleted: 204.</summary>
    Deleted,

    /// <summary>Field errors: 400.</summary>
    Invalid,

    /// <summary>No plan has this id: 404.</summary>
    NotFound,

    /// <summary>The plan belongs to another user: 403, never with plan data.</summary>
    Forbidden,
}

/// <summary>
/// The result of renaming, replacing, duplicating or deleting a saved plan, in the same shape as
/// <see cref="SavePlanResult"/> and <see cref="SavedPlanLookup"/>.
/// </summary>
public sealed record SavedPlanChange
{
    private SavedPlanChange()
    {
    }

    public SavedPlanChangeOutcome Outcome { get; private init; }

    public SavedPlan? Plan { get; private init; }

    public IReadOnlyList<KeyValuePair<string, string>> Errors { get; private init; } = [];

    [MemberNotNullWhen(true, nameof(Plan))]
    public bool HasPlan => Plan is not null;

    public static SavedPlanChange Changed(SavedPlan plan) =>
        new() { Outcome = SavedPlanChangeOutcome.Changed, Plan = plan };

    public static SavedPlanChange Invalid(IReadOnlyList<KeyValuePair<string, string>> errors) =>
        new() { Outcome = SavedPlanChangeOutcome.Invalid, Errors = errors };

    public static readonly SavedPlanChange Deleted = new() { Outcome = SavedPlanChangeOutcome.Deleted };

    public static readonly SavedPlanChange NotFound = new() { Outcome = SavedPlanChangeOutcome.NotFound };

    public static readonly SavedPlanChange Forbidden = new() { Outcome = SavedPlanChangeOutcome.Forbidden };
}
