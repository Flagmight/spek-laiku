namespace SpekLaiku.Api.Services;

/// <summary>What a request to delete one's own account produced (feature 016 data-model.md, "Service result").</summary>
public enum AccountDeletionOutcome
{
    /// <summary>The account and all its plans were deleted: 204, and the user is signed out.</summary>
    Deleted,

    /// <summary>A field is invalid; nothing was checked or counted: 400 with the field errors.</summary>
    Invalid,

    /// <summary>The password is wrong; one failed attempt was counted: 400 "Password is incorrect.".</summary>
    IncorrectPassword,

    /// <summary>The account is locked for login, or this attempt locked it: 429.</summary>
    LockedOut,

    /// <summary>The account is no longer an Active Registered User account, or no longer exists: 403.</summary>
    NotAllowed,
}

/// <summary>The result of deleting one's own account, in the style of <see cref="AccountStatusChange"/>.</summary>
public sealed record AccountDeletionResult
{
    private static readonly IReadOnlyDictionary<string, string> NoErrors = new Dictionary<string, string>();

    private AccountDeletionResult()
    {
    }

    public AccountDeletionOutcome Outcome { get; private init; }

    /// <summary>Field errors keyed by request field name (<c>password</c>); empty unless <see cref="AccountDeletionOutcome.Invalid"/>.</summary>
    public IReadOnlyDictionary<string, string> Errors { get; private init; } = NoErrors;

    /// <summary>How many saved plans were deleted, for the log only; it is never returned to the browser.</summary>
    public int PlanCount { get; private init; }

    public static AccountDeletionResult Deleted(int planCount) =>
        new() { Outcome = AccountDeletionOutcome.Deleted, PlanCount = planCount };

    public static AccountDeletionResult Invalid(IReadOnlyDictionary<string, string> errors) =>
        new() { Outcome = AccountDeletionOutcome.Invalid, Errors = errors };

    public static readonly AccountDeletionResult IncorrectPassword =
        new() { Outcome = AccountDeletionOutcome.IncorrectPassword };

    public static readonly AccountDeletionResult LockedOut = new() { Outcome = AccountDeletionOutcome.LockedOut };

    public static readonly AccountDeletionResult NotAllowed = new() { Outcome = AccountDeletionOutcome.NotAllowed };
}
