namespace SpekLaiku.IntegrationTests;

/// <summary>
/// A clock that shows the time a test sets. Only <c>ForecastPeriod</c> uses it; sign-in cookies and
/// Identity keep the real clock, so moving this one never signs anyone out.
/// </summary>
public sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
{
    public DateTimeOffset UtcNow { get; set; } = utcNow;

    public override DateTimeOffset GetUtcNow() => UtcNow;
}
