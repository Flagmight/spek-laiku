namespace SpekLaiku.Api.RateLimiting;

/// <summary>The rate limiting policy names, so controllers refer to them by constant.</summary>
public static class RateLimitPolicies
{
    /// <summary>
    /// Location searches, plan setup checks, forecast requests and place requests together: 30 per minute per
    /// network address by default (feature 004 spec FR-027, feature 006 spec FR-008, feature 007 spec FR-011,
    /// project FR-049). Every endpoint that names this policy shares its limiter.
    /// </summary>
    public const string PlanSetup = "PlanSetup";
}
