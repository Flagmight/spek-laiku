using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

public sealed class VerificationService(
    UserManager<ApplicationUser> userManager,
    IDataProtector dataProtector,
    ILogger<VerificationService> logger)
{
    private static readonly TimeSpan VerificationExpiry = TimeSpan.FromHours(1);

    public async Task<string> CreateTokenAsync(ApplicationUser user, CancellationToken cancellationToken = default)
    {
        var identityToken = await userManager.GenerateEmailConfirmationTokenAsync(user);
        return dataProtector.Protect($"{user.Id}\u001f{identityToken}\u001f{DateTime.UtcNow.Add(VerificationExpiry):O}");
    }

    public async Task<VerificationResult> VerifyAsync(string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token)) return new(false, "The verification link is invalid.");

        try
        {
            var payload = dataProtector.Unprotect(token);
            var fields = payload.Split('\u001f', 3);
            if (fields.Length != 3 || string.IsNullOrWhiteSpace(fields[0]))
                return new(false, "The verification link is invalid.");
            if (!DateTime.TryParse(fields[2], out var expiresAt) || expiresAt <= DateTime.UtcNow)
                return new(false, "The verification link has expired.");

            var user = await userManager.Users.SingleOrDefaultAsync(
                candidate => candidate.Id == fields[0], cancellationToken);
            if (user is null || user.AccountStatus != AccountStatus.PendingVerification)
                return new(false, "The verification link is invalid.");

            user.VerificationAttemptedAt = DateTime.UtcNow;
            var confirmResult = await userManager.ConfirmEmailAsync(user, fields[1]);
            if (!confirmResult.Succeeded) return new(false, "The verification link is invalid.");

            user.AccountStatus = AccountStatus.Active;
            user.EmailConfirmed = true;
            user.VerificationSentAt = null;
            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded) return new(false, "Account verification could not be completed.");

            logger.LogInformation("Verified user {UserId}", user.Id);
            return new(true);
        }
        catch (CryptographicException)
        {
            logger.LogWarning("Invalid verification token received");
            return new(false, "The verification link is invalid.");
        }
    }
}
