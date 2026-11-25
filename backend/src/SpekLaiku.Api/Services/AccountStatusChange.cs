using System.Diagnostics.CodeAnalysis;

namespace SpekLaiku.Api.Services;

/// <summary>What setting an account's status produced (feature 014 data-model.md, "AccountStatusChange").</summary>
public enum AccountStatusChangeOutcome
{
    /// <summary>The status was changed and logged: 200 with the account.</summary>
    Changed,

    /// <summary>The account already had that status; nothing was written or logged: 200 with the account.</summary>
    Unchanged,

    /// <summary>No account has this id: 404.</summary>
    NotFound,

    /// <summary>The account is an Administrator account, which this feature never changes: 409.</summary>
    AdministratorAccount,
}

/// <summary>The result of suspending or reactivating an account, in the style of <see cref="SavedPlanChange"/>.</summary>
public sealed record AccountStatusChange
{
    private AccountStatusChange()
    {
    }

    public AccountStatusChangeOutcome Outcome { get; private init; }

    public AdminAccountSummary? Account { get; private init; }

    [MemberNotNullWhen(true, nameof(Account))]
    public bool HasAccount => Account is not null;

    public static AccountStatusChange Changed(AdminAccountSummary account) =>
        new() { Outcome = AccountStatusChangeOutcome.Changed, Account = account };

    public static AccountStatusChange Unchanged(AdminAccountSummary account) =>
        new() { Outcome = AccountStatusChangeOutcome.Unchanged, Account = account };

    public static readonly AccountStatusChange NotFound = new() { Outcome = AccountStatusChangeOutcome.NotFound };

    public static readonly AccountStatusChange AdministratorAccount =
        new() { Outcome = AccountStatusChangeOutcome.AdministratorAccount };
}
