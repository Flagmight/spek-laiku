using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.UnitTests;

/// <summary>The login password never appears in the request's text form (FR-022).</summary>
public class LoginRequestTests
{
    [Fact]
    public void ToString_MasksPassword()
    {
        var text = new LoginRequest("user@example.com", "Secret-Password-42").ToString();

        Assert.DoesNotContain("Secret-Password-42", text);
        Assert.Contains("user@example.com", text);
        Assert.Contains("Password = ***", text);
    }
}
