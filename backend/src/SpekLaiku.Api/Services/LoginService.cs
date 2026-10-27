using Microsoft.AspNetCore.Identity;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks a user's email and password (FR-001 to FR-005, FR-026). Signing in is left to the caller.
/// </summary>
public sealed class LoginService(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    ILogger<LoginService> logger)
{
    public async Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        // Invalid fields never look up an account or count a failed attempt.
        var errors = LoginValidator.Validate(request);
        if (errors.Count > 0)
        {
            return LoginResult.Invalid(errors);
        }

        // FindByEmailAsync compares normalized emails, so the letter case does not matter.
        var user = await userManager.FindByEmailAsync(request.Email!.Trim());
        if (user is null)
        {
            return LoginResult.IncorrectCredentials();
        }

        // A locked account gets the same answer as a wrong password, even with the correct one (FR-026).
        // Checked here so the lock is logged only by the attempt that caused it.
        if (await userManager.IsLockedOutAsync(user))
        {
            return LoginResult.IncorrectCredentials();
        }

        // The password is checked exactly as entered: it is never trimmed or changed (FR-003).
        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password!, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            // Only the internal identifier: never the email or the password (FR-027).
            logger.LogWarning("Account {UserId} locked after repeated failed logins.", user.Id);
            return LoginResult.IncorrectCredentials();
        }

        // Successful and other failed logins are not logged (FR-027).
        return result.Succeeded ? LoginResult.Success(user) : LoginResult.IncorrectCredentials();
    }
}
