namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// The User accounts list: at most 50 accounts, newest registration first. <see cref="HasMore"/> is true when more
/// accounts match than are returned (feature 014 spec FR-001).
/// </summary>
public sealed record AdminAccountListResponse(IReadOnlyList<AdminAccountResponse> Accounts, bool HasMore);
