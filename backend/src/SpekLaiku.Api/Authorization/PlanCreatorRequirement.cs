using Microsoft.AspNetCore.Authorization;

namespace SpekLaiku.Api.Authorization;

/// <summary>The caller may set up a plan: a Visitor or an Active Registered User (feature 004, research section 8).</summary>
public sealed class PlanCreatorRequirement : IAuthorizationRequirement;
