using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.UnitTests;

/// <summary>The password never appears in the account deletion request's text form (feature 016 spec FR-015).</summary>
public class AccountDeletionRequestTests
{
    [Fact]
    public void ToString_MasksPassword()
    {
        var text = new AccountDeletionRequest("Secret-Password-42").ToString();

        Assert.DoesNotContain("Secret-Password-42", text);
        Assert.Contains("Password = ***", text);
    }
}
