using Microsoft.AspNetCore.Authorization;

namespace SpekLaiku.Api.Authorization;

/// <summary>Met by <see cref="ActiveAdministratorHandler"/> for an Active Administrator account.</summary>
public sealed class ActiveAdministratorRequirement : IAuthorizationRequirement;
