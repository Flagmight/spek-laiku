using System.Diagnostics.CodeAnalysis;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>What a save produced (feature 010 contracts/plans-api.md).</summary>
public enum SavePlanOutcome
{
    /// <summary>A new plan: 201.</summary>
    Created,

    /// <summary>The same user already saved this generated schedule; nothing new was stored: 200.</summary>
    AlreadySaved,

    /// <summary>Name or generated schedule errors: 400.</summary>
    Invalid,
}

/// <summary>
/// The outcome of a save: the plan, or the field errors, in the same shape as <see cref="PlanScheduleResult"/>.
/// </summary>
public sealed record SavePlanResult
{
    private SavePlanResult()
    {
    }

    public SavePlanOutcome Outcome { get; private init; }

    public SavedPlan? Plan { get; private init; }

    public IReadOnlyList<KeyValuePair<string, string>> Errors { get; private init; } = [];

    [MemberNotNullWhen(true, nameof(Plan))]
    public bool Succeeded => Outcome != SavePlanOutcome.Invalid;

    public static SavePlanResult Created(SavedPlan plan) => new() { Outcome = SavePlanOutcome.Created, Plan = plan };

    public static SavePlanResult AlreadySaved(SavedPlan plan) =>
        new() { Outcome = SavePlanOutcome.AlreadySaved, Plan = plan };

    public static SavePlanResult Invalid(IReadOnlyList<KeyValuePair<string, string>> errors) =>
        new() { Outcome = SavePlanOutcome.Invalid, Errors = errors };
}
