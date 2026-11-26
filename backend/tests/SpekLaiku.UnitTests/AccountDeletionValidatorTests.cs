using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The password rule of the account deletion request (feature 016 spec FR-002).</summary>
public class AccountDeletionValidatorTests
{
    [Fact]
    public void NullPassword_GivesEnterYourPassword()
    {
        AssertEnterYourPassword(new AccountDeletionRequest(null));
    }

    [Fact]
    public void EmptyPassword_GivesEnterYourPassword()
    {
        AssertEnterYourPassword(new AccountDeletionRequest(string.Empty));
    }

    [Fact]
    public void SpacesOnly_IsAccepted()
    {
        Assert.Empty(AccountDeletionValidator.Validate(new AccountDeletionRequest("   ")));
    }

    [Fact]
    public void NormalPassword_IsAccepted()
    {
        Assert.Empty(AccountDeletionValidator.Validate(new AccountDeletionRequest("Password123!")));
    }

    private static void AssertEnterYourPassword(AccountDeletionRequest request)
    {
        var error = Assert.Single(AccountDeletionValidator.Validate(request));
        Assert.Equal("password", error.Key);
        Assert.Equal("Enter your password.", error.Value);
    }
}
