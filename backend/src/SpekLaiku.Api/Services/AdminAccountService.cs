using System.Linq.Expressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Lists accounts for the User accounts page and suspends or reactivates Registered User accounts (feature 014 spec
/// FR-001 to FR-010, FR-021). A technical failure is not caught or logged here: it reaches ApiExceptionHandler, which
/// logs it and answers 500, as in ActivityCategoryService.
/// </summary>
public sealed class AdminAccountService(
    ApplicationDbContext context,
    UserManager<ApplicationUser> userManager,
    ILogger<AdminAccountService> logger)
{
    /// <summary>The most accounts one answer lists (spec FR-001).</summary>
    public const int PageSize = 50;

    // Identity's key column length; a longer id cannot exist, so it is answered without a query.
    private const int MaxIdLength = 450;

    // The only columns the page may see. Shared by the list and the answer to a change, so neither ever reads the
    // password hash or the stamps (research section 10).
    private static readonly Expression<Func<ApplicationUser, AdminAccountSummary>> ToSummary = user =>
        new AdminAccountSummary(user.Id, user.Email ?? string.Empty, user.Role, user.AccountStatus, user.RegistrationDate);

    /// <summary>
    /// Accounts whose email contains <paramref name="search"/>, ignoring letter case, or every account when it is empty;
    /// newest registration first, at most <see cref="PageSize"/> (research sections 5 and 6). The text must already be
    /// checked by <see cref="AdminAccountSearch"/>. EF Core turns <c>Contains</c> into <c>LIKE</c> with a parameter whose
    /// wildcards are escaped, so "%" and "_" are matched literally (AdminAccountsListEndpointTests).
    /// </summary>
    public async Task<AdminAccountListing> ListAsync(string search, CancellationToken cancellationToken)
    {
        var query = context.Users.AsNoTracking();
        if (search.Length > 0)
        {
            // The same normalizer Identity uses for NormalizedEmail; it returns null only for a null text.
            var normalized = userManager.NormalizeEmail(search)!;
            query = query.Where(user => user.NormalizedEmail!.Contains(normalized));
        }

        var accounts = await query
            .OrderByDescending(user => user.RegistrationDate)
            .ThenBy(user => user.Id)
            .Select(ToSummary)
            .Take(PageSize + 1)
            .ToListAsync(cancellationToken);

        return new AdminAccountListing([.. accounts.Take(PageSize)], accounts.Count > PageSize);
    }

    /// <summary>
    /// Sets a Registered User account's status (spec FR-007, FR-008). The role check and the change are one statement,
    /// so an account that became an Administrator after the list was loaded can never be changed in a race. The change
    /// also writes a new concurrency stamp: Identity's UpdateAsync rewrites every column, so an update that began before
    /// the suspension (for example counting a failed login) would otherwise write the old status back; with the new
    /// stamp it fails Identity's concurrency check instead (research section 3). A repeat writes and logs nothing.
    /// </summary>
    public async Task<AccountStatusChange> SetStatusAsync(
        string administratorId,
        string accountId,
        AccountStatus status,
        CancellationToken cancellationToken)
    {
        if (accountId.Length > MaxIdLength)
        {
            return AccountStatusChange.NotFound;
        }

        var updated = await context.Users
            .Where(user => user.Id == accountId
                && user.Role == PlanCreatorHandler.RegisteredUserRole
                && user.AccountStatus != status)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(user => user.AccountStatus, status)
                    .SetProperty(user => user.ConcurrencyStamp, Guid.NewGuid().ToString()),
                cancellationToken);

        var account = await context.Users.AsNoTracking()
            .Where(user => user.Id == accountId)
            .Select(ToSummary)
            .SingleOrDefaultAsync(cancellationToken);
        if (account is null)
        {
            return AccountStatusChange.NotFound;
        }

        if (account.Role != PlanCreatorHandler.RegisteredUserRole)
        {
            return AccountStatusChange.AdministratorAccount;
        }

        if (updated == 0)
        {
            return AccountStatusChange.Unchanged(account);
        }

        // Ids only: an email is personal data and never goes to the log (spec FR-021).
        if (status == AccountStatus.Suspended)
        {
            logger.LogInformation(
                "Account {AccountId} suspended by administrator {AdministratorId}.", accountId, administratorId);
        }
        else
        {
            logger.LogInformation(
                "Account {AccountId} reactivated by administrator {AdministratorId}.", accountId, administratorId);
        }

        return AccountStatusChange.Changed(account);
    }
}
