namespace SpekLaiku.Api.RateLimiting;

/// <summary>The rate limiting policy names, so controllers refer to them by constant.</summary>
public static class RateLimitPolicies
{
    /// <summary>
    /// Location searches and plan setup checks together: 30 per minute per network address by default
    /// (spec FR-027, project FR-049).
    /// </summary>
    public const string PlanSetup = "PlanSetup";
}
