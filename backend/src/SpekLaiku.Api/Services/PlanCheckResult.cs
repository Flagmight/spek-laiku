using System.Diagnostics.CodeAnalysis;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of checking a saved plan (feature 012 data-model.md PlanCheckResult): the check, no plan with that
/// id (404), or another user's plan (403, with no plan data). A weather service failure is not an outcome; it is
/// an exception that <c>ApiExceptionHandler</c> answers with 503.
/// </summary>
public sealed record PlanCheckResult
{
    private PlanCheckResult()
    {
    }

    public PlanCheck? Check { get; private init; }

    public bool IsForbidden { get; private init; }

    [MemberNotNullWhen(true, nameof(Check))]
    public bool Found => Check is not null;

    public static PlanCheckResult Of(PlanCheck check) => new() { Check = check };

    public static readonly PlanCheckResult NotFound = new();

    public static readonly PlanCheckResult Forbidden = new() { IsForbidden = true };
}
