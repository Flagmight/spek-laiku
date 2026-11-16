using System.Diagnostics.CodeAnalysis;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of a schedule request: the schedule, or the errors of the plan check (setup or activities),
/// following the same shape as <see cref="PlanForecastResult"/> and <see cref="PlanPlacesResult"/>.
/// </summary>
public sealed record PlanScheduleResult
{
    private PlanScheduleResult()
    {
    }

    [MemberNotNullWhen(true, nameof(Schedule))]
    public bool Succeeded { get; private init; }

    public PlanSchedule? Schedule { get; private init; }

    public IReadOnlyList<KeyValuePair<string, string>> Errors { get; private init; } = [];

    public static PlanScheduleResult Success(PlanSchedule schedule) => new() { Succeeded = true, Schedule = schedule };

    public static PlanScheduleResult Invalid(IReadOnlyList<KeyValuePair<string, string>> errors) => new() { Errors = errors };
}
