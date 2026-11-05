using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Authorization;

/// <summary>
/// Succeeds for a Visitor (not signed in) and for a signed-in, Active Registered User. An Administrator
/// must not create plans for users (project FR-032) and a Suspended user is blocked (project FR-041).
/// As in <see cref="ActiveAdministratorHandler"/>, the account is read on every request, so a suspension
/// applies at once and a deleted account is refused (research section 8).
/// </summary>
public sealed class PlanCreatorHandler(UserManager<ApplicationUser> userManager)
    : AuthorizationHandler<PlanCreatorRequirement>
{
    public const string RegisteredUserRole = "Registered User";

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PlanCreatorRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            context.Succeed(requirement);
            return;
        }

        var user = await userManager.GetUserAsync(context.User);
        if (user is { Role: RegisteredUserRole, AccountStatus: AccountStatus.Active })
        {
            context.Succeed(requirement);
        }
    }
}
