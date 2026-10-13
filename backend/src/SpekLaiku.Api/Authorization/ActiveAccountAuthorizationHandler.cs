using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Authorization;

public sealed class ActiveAccountAuthorizationHandler(
    UserManager<ApplicationUser> userManager) : AuthorizationHandler<ActiveAccountRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ActiveAccountRequirement requirement)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return;
        }

        var user = await userManager.FindByIdAsync(userId);
        if (user is { AccountStatus: AccountStatus.Active, EmailConfirmed: true })
        {
            context.Succeed(requirement);
        }
    }
}
