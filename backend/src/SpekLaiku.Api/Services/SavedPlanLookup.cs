using System.Diagnostics.CodeAnalysis;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The result of opening one saved plan (feature 010 spec FR-012, data-model.md "Reading a plan"): the plan, no
/// plan with that id (404), or another user's plan (403, with no plan data).
/// </summary>
public sealed record SavedPlanLookup
{
    private SavedPlanLookup()
    {
    }

    public SavedPlan? Plan { get; private init; }

    public bool IsForbidden { get; private init; }

    [MemberNotNullWhen(true, nameof(Plan))]
    public bool Found => Plan is not null;

    public static SavedPlanLookup Of(SavedPlan plan) => new() { Plan = plan };

    public static readonly SavedPlanLookup NotFound = new();

    public static readonly SavedPlanLookup Forbidden = new() { IsForbidden = true };
}
