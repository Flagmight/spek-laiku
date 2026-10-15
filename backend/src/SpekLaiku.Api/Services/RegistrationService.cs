using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

public sealed class RegistrationService(UserManager<ApplicationUser> userManager)
{
    public async Task<RegistrationResult> RegisterAsync(RegistrationRequest request, CancellationToken cancellationToken = default)
    {
        var errors = RegistrationValidator.Validate(request);
        if (errors.Count > 0)
        {
            return RegistrationResult.Invalid(errors);
        }

        // The validator guarantees all three fields are present.
        var email = request.Email!.Trim();
        var password = request.Password!;

        var normalizedEmail = email.ToUpperInvariant();
        if (await userManager.Users.AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken))
        {
            return DuplicateEmail();
        }

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

        IdentityResult createResult;
        try
        {
            createResult = await userManager.CreateAsync(user, password);
        }
        catch (DbUpdateException exception) when (IsDuplicateEmailViolation(exception))
        {
            // A simultaneous registration with the same email passed the check above first.
            return DuplicateEmail();
        }
        catch (DbUpdateException)
        {
            return RegistrationResult.TechnicalFailure();
        }

        if (createResult.Succeeded)
        {
            return RegistrationResult.Success();
        }

        return createResult.Errors.Any(error => DuplicateErrorCodes.Contains(error.Code))
            ? DuplicateEmail()
            : RegistrationResult.TechnicalFailure();
    }

    private static RegistrationResult DuplicateEmail() =>
        RegistrationResult.Invalid("email", "This email is already registered.");

    // Both indexes hold the normalized email, because the user name is the email.
    private static bool IsDuplicateEmailViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "EmailIndex" or "UserNameIndex"
        };

    private static readonly string[] DuplicateErrorCodes =
    [
        nameof(IdentityErrorDescriber.DuplicateEmail),
        nameof(IdentityErrorDescriber.DuplicateUserName)
    ];
}
