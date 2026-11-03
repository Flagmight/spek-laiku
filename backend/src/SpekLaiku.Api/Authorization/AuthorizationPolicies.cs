namespace SpekLaiku.Api.Authorization;

/// <summary>The authorization policy names, so controllers refer to them by constant.</summary>
public static class AuthorizationPolicies
{
    /// <summary>A signed-in account with the Administrator role and Active status (spec FR-016 to FR-019).</summary>
    public const string ActiveAdministrator = "ActiveAdministrator";
}
