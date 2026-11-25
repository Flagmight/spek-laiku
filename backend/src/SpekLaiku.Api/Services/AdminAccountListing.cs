namespace SpekLaiku.Api.Services;

/// <summary>
/// One page of the User accounts list: at most 50 accounts, newest registration first, and whether more accounts
/// match (feature 014 spec FR-001, research section 6).
/// </summary>
public sealed record AdminAccountListing(IReadOnlyList<AdminAccountSummary> Accounts, bool HasMore);
