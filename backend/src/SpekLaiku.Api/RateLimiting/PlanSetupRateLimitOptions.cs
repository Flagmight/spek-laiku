namespace SpekLaiku.Api.RateLimiting;

/// <summary>
/// The <c>RateLimiting:PlanSetup</c> settings (data-model.md, Configuration). They can be changed without a
/// code change, for example with the environment variable <c>RateLimiting__PlanSetup__PermitLimit</c>.
/// </summary>
public sealed class PlanSetupRateLimitOptions
{
    public const string SectionName = "RateLimiting:PlanSetup";

    /// <summary>Requests allowed per window and network address.</summary>
    public int PermitLimit { get; init; } = 30;

    /// <summary>Length of the fixed window in seconds.</summary>
    public int WindowSeconds { get; init; } = 60;
}
