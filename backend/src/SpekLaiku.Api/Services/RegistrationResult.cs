using System.Diagnostics.CodeAnalysis;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The outcome of a registration: success, field errors keyed by request field name
/// (<c>email</c>, <c>password</c>, <c>passwordConfirmation</c>), or a technical failure.
/// </summary>
public sealed record RegistrationResult
{
    private static readonly IReadOnlyDictionary<string, string> NoErrors = new Dictionary<string, string>();

    private RegistrationResult()
    {
    }

    [MemberNotNullWhen(true, nameof(User))]
    public bool Succeeded { get; private init; }

    public bool IsTechnicalFailure { get; private init; }

    public IReadOnlyDictionary<string, string> Errors { get; private init; } = NoErrors;

    /// <summary>The created account, so the caller can sign the new user in.</summary>
    public ApplicationUser? User { get; private init; }

    public static RegistrationResult Success(ApplicationUser user) => new() { Succeeded = true, User = user };

    public static RegistrationResult Invalid(IReadOnlyDictionary<string, string> errors) => new() { Errors = errors };

    public static RegistrationResult Invalid(string field, string message) =>
        Invalid(new Dictionary<string, string> { [field] = message });

    public static RegistrationResult TechnicalFailure() => new() { IsTechnicalFailure = true };
}
