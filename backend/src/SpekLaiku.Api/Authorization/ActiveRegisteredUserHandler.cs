using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Authorization;

/// <summary>
/// Succeeds only for a signed-in, Active Registered User, the only people who save, list and open plans
/// (feature 010 spec FR-012, research section 7). A Visitor never reaches it with success: the policy also
/// requires a signed-in user, which gives 401. As in <see cref="PlanCreatorHandler"/>, the account is read on
/// every request, so a suspension applies at once and a deleted account is refused.
/// </summary>
public sealed class ActiveRegisteredUserHandler(UserManager<ApplicationUser> userManager)
    : AuthorizationHandler<ActiveRegisteredUserRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ActiveRegisteredUserRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var user = await userManager.GetUserAsync(context.User);
        if (user is { Role: PlanCreatorHandler.RegisteredUserRole, AccountStatus: AccountStatus.Active })
        {
            context.Succeed(requirement);
        }
    }
}
