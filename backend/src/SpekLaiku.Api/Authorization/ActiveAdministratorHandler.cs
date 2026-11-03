using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Authorization;

/// <summary>
/// Succeeds only when the signed-in account exists, has the Administrator role and is Active.
/// The account is read from the database on every request, not from claims in the cookie, because
/// the role and status are columns on the account that can change while the user is signed in:
/// a suspended or demoted administrator is refused at once, not when the cookie expires
/// (research section 1).
/// </summary>
public sealed class ActiveAdministratorHandler(UserManager<ApplicationUser> userManager)
    : AuthorizationHandler<ActiveAdministratorRequirement>
{
    public const string AdministratorRole = "Administrator";

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ActiveAdministratorRequirement requirement)
    {
        var user = await userManager.GetUserAsync(context.User);
        if (user is { Role: AdministratorRole, AccountStatus: AccountStatus.Active })
        {
            context.Succeed(requirement);
        }
    }
}
