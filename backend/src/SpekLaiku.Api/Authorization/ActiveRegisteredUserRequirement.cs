using Microsoft.AspNetCore.Authorization;

namespace SpekLaiku.Api.Authorization;

/// <summary>The caller owns saved plans: a signed-in, Active Registered User (feature 010, research section 7).</summary>
public sealed class ActiveRegisteredUserRequirement : IAuthorizationRequirement;
