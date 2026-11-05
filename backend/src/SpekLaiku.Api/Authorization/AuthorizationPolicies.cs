namespace SpekLaiku.Api.Authorization;

/// <summary>The authorization policy names, so controllers refer to them by constant.</summary>
public static class AuthorizationPolicies
{
    /// <summary>A signed-in account with the Administrator role and Active status (spec FR-016 to FR-019).</summary>
    public const string ActiveAdministrator = "ActiveAdministrator";

    /// <summary>
    /// A Visitor or a signed-in Active Registered User, the people who may set up a plan (feature 004,
    /// spec FR-003). It does not require signing in.
    /// </summary>
    public const string PlanCreator = "PlanCreator";
}
