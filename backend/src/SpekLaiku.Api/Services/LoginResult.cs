using System.Diagnostics.CodeAnalysis;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of a login: success, field errors keyed by request field name (<c>email</c>, <c>password</c>),
/// or incorrect credentials, which covers an unknown email, a wrong password and a locked account alike.
/// </summary>
public sealed record LoginResult
{
    private static readonly IReadOnlyDictionary<string, string> NoErrors = new Dictionary<string, string>();

    private LoginResult()
    {
    }

    [MemberNotNullWhen(true, nameof(User))]
    public bool Succeeded { get; private init; }

    public bool IsIncorrectCredentials { get; private init; }

    public IReadOnlyDictionary<string, string> Errors { get; private init; } = NoErrors;

    /// <summary>The account whose details matched, so the caller can sign the user in.</summary>
    public ApplicationUser? User { get; private init; }

    public static LoginResult Success(ApplicationUser user) => new() { Succeeded = true, User = user };

    public static LoginResult Invalid(IReadOnlyDictionary<string, string> errors) => new() { Errors = errors };

    public static LoginResult IncorrectCredentials() => new() { IsIncorrectCredentials = true };
}
