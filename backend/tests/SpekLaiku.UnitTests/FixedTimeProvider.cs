namespace SpekLaiku.UnitTests;

/// <summary>A clock that shows the time a test sets, so date rules are tested at exact moments.</summary>
public sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
{
    public DateTimeOffset UtcNow { get; set; } = utcNow;

    public override DateTimeOffset GetUtcNow() => UtcNow;
}
