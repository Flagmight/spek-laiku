using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Deletes the signed-in user's own account and all their saved plans after checking their password (feature 016 spec
/// FR-002, FR-003, FR-009, FR-015, FR-016).
/// <list type="bullet">
/// <item>The password is checked with the same Identity call as Log in, so wrong passwords count towards the same
/// 5-attempt, 15-minute lock (research section 4).</item>
/// <item>The plans and the account are deleted in one transaction, and the account only while it is still an Active
/// Registered User account. <c>UserManager.DeleteAsync</c> is not used: it has no such condition, a concurrent
/// suspension would make it fail as a concurrency error, and it gives no plan count (research section 5).</item>
/// </list>
/// A technical failure is not caught here: it reaches ApiExceptionHandler, which logs it and answers 500, and the
/// transaction is rolled back when it is disposed.
/// </summary>
public sealed class AccountDeletionService(
    ApplicationDbContext context,
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    ILogger<AccountDeletionService> logger)
{
    public async Task<AccountDeletionResult> DeleteAsync(
        ClaimsPrincipal principal,
        AccountDeletionRequest request,
        CancellationToken cancellationToken)
    {
        // Invalid fields never read the account or count a failed attempt.
        var errors = AccountDeletionValidator.Validate(request);
        if (errors.Count > 0)
        {
            return AccountDeletionResult.Invalid(errors);
        }

        // The policy already checked this; the account may have changed or gone since.
        var user = await userManager.GetUserAsync(principal);
        if (user is not { Role: PlanCreatorHandler.RegisteredUserRole, AccountStatus: AccountStatus.Active })
        {
            return AccountDeletionResult.NotAllowed;
        }

        // Already locked: even the correct password is refused, and nothing is logged (the lock was logged when it
        // happened). Checked here, as in LoginService, so only the attempt that causes the lock logs it.
        if (await userManager.IsLockedOutAsync(user))
        {
            return AccountDeletionResult.LockedOut;
        }

        // The password is checked exactly as entered: it is never trimmed or changed.
        var check = await signInManager.CheckPasswordSignInAsync(user, request.Password!, lockoutOnFailure: true);
        if (check.IsLockedOut)
        {
            // Only the internal identifier: never the email or the password (spec FR-015).
            logger.LogWarning("Account {UserId} locked after repeated failed password checks.", user.Id);
            return AccountDeletionResult.LockedOut;
        }

        if (!check.Succeeded)
        {
            // Wrong passwords are not logged (spec FR-015).
            return AccountDeletionResult.IncorrectPassword;
        }

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        var planCount = await context.SavedPlans
            .Where(plan => plan.OwnerId == user.Id)
            .ExecuteDeleteAsync(cancellationToken);
        // The existing ON DELETE CASCADE keys remove the account's Identity rows, and any plan saved since the line
        // above, in the same statement.
        var deleted = await context.Users
            .Where(account => account.Id == user.Id
                && account.Role == PlanCreatorHandler.RegisteredUserRole
                && account.AccountStatus == AccountStatus.Active)
            .ExecuteDeleteAsync(cancellationToken);
        if (deleted != 1)
        {
            // Suspended, promoted or deleted after the check above: nothing is deleted.
            await transaction.RollbackAsync(CancellationToken.None);
            return AccountDeletionResult.NotAllowed;
        }

        // Not cancelled by the browser giving up: once the account row is deleted, the deletion is committed and
        // logged, so the server's state and its log agree (code review in T031).
        await transaction.CommitAsync(CancellationToken.None);
        logger.LogInformation("Account {UserId} deleted with {PlanCount} saved plans.", user.Id, planCount);
        return AccountDeletionResult.Deleted(planCount);
    }
}
