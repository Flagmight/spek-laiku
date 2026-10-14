using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

public sealed class CurrentUserService(UserManager<ApplicationUser> userManager)
{
    // Returns null when the signed-in principal no longer matches a stored account.
    public Task<ApplicationUser?> GetAsync(ClaimsPrincipal principal)
        => userManager.GetUserAsync(principal);
}
