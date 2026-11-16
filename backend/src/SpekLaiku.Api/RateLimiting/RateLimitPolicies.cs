namespace SpekLaiku.Api.RateLimiting;

/// <summary>The rate limiting policy names, so controllers refer to them by constant.</summary>
public static class RateLimitPolicies
{
    /// <summary>
    /// Location searches, plan setup checks, forecast requests, place requests and schedule requests together:
    /// 30 per minute per network address by default (feature 004 spec FR-027, feature 006 spec FR-008,
    /// feature 007 spec FR-011, feature 008 spec FR-008, project FR-049). Every endpoint that names this
    /// policy shares its limiter.
    /// </summary>
    public const string PlanSetup = "PlanSetup";
}
