using Microsoft.AspNetCore.Identity;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks a user's email and password (FR-001, FR-003, FR-004). Signing in is left to the caller.
/// </summary>
public sealed class LoginService(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager)
{
    public async Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        // Until LoginValidator exists (US2), an empty form is treated as incorrect details, never a 500.
        var email = request.Email?.Trim();
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(request.Password))
        {
            return LoginResult.IncorrectCredentials();
        }

        // FindByEmailAsync compares normalized emails, so the letter case does not matter.
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return LoginResult.IncorrectCredentials();
        }

        // The password is checked exactly as entered: it is never trimmed or changed (FR-003).
        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        // Successful and failed logins are not logged (FR-027).
        return result.Succeeded ? LoginResult.Success(user) : LoginResult.IncorrectCredentials();
    }
}
