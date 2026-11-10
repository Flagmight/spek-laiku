using System.Diagnostics.CodeAnalysis;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of a forecast request: the forecast, or the errors of the setup check (every key prefixed
/// <c>setup</c>) or of the activity check (its own <c>activities</c> keys), in their checks' order.
/// </summary>
public sealed record PlanForecastResult
{
    private PlanForecastResult()
    {
    }

    [MemberNotNullWhen(true, nameof(Forecast))]
    public bool Succeeded { get; private init; }

    public PlanForecast? Forecast { get; private init; }

    public IReadOnlyList<KeyValuePair<string, string>> Errors { get; private init; } = [];

    public static PlanForecastResult Success(PlanForecast forecast) => new() { Succeeded = true, Forecast = forecast };

    public static PlanForecastResult Invalid(IReadOnlyList<KeyValuePair<string, string>> errors) => new() { Errors = errors };
}
