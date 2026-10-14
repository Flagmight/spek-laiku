using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

public sealed class RegistrationService(UserManager<ApplicationUser> userManager)
{
    public async Task<RegistrationResult> RegisterAsync(RegistrationRequest request, CancellationToken cancellationToken = default)
    {
        var email = request.Email.Trim();
        if (!IsValidEmail(email)) return new(false, "Enter a valid email address.");
        if (email.Length > 254) return new(false, "Enter a valid email address.");
        if (request.Password.Length is < 8 or > 128) return new(false, "Password must be at least 8 characters.");
        if (!string.Equals(request.Password, request.PasswordConfirmation, StringComparison.Ordinal))
            return new(false, "Passwords do not match.");

        var normalizedEmail = email.ToUpperInvariant();
        if (await userManager.Users.AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken))
            return new(false, "This email is already registered.");

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            NormalizedEmail = normalizedEmail,
            NormalizedUserName = normalizedEmail,
            Role = "Registered User",
            AccountStatus = AccountStatus.Active,
            RegistrationDate = DateTime.UtcNow
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        return createResult.Succeeded
            ? new(true)
            : new(false, "Account could not be created. Try again later.");
    }

    private static bool IsValidEmail(string email)
        => email.Contains('@') && email.LastIndexOf('@') > 0 && email.LastIndexOf('@') == email.IndexOf('@')
            && email.IndexOf('@') < email.Length - 1 && !email.Any(character => char.IsWhiteSpace(character));
}
