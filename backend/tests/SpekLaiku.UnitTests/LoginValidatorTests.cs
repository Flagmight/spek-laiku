using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Every login field message (FR-002, FR-005, FR-008).</summary>
public class LoginValidatorTests
{
    private const string Email = "user@example.com";
    private const string Password = "Password123!";

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyEmail_ReturnsEnterYourEmail(string? email)
    {
        AssertSingleError(new LoginRequest(email, Password), "email", "Enter your email address.");
    }

    [Theory]
    [InlineData("userexample.com")]
    [InlineData("a@@b.lt")]
    [InlineData("@b.lt")]
    [InlineData("a@b")]
    [InlineData("a b@c.lt")]
    public void InvalidEmailFormat_ReturnsEnterValidEmail(string email)
    {
        AssertSingleError(new LoginRequest(email, Password), "email", "Enter a valid email address.");
    }

    [Fact]
    public void EmailLongerThan254Characters_ReturnsEnterValidEmail()
    {
        var email = new string('a', 243) + "@example.com";
        Assert.Equal(255, email.Length);

        AssertSingleError(new LoginRequest(email, Password), "email", "Enter a valid email address.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void EmptyPassword_ReturnsEnterYourPassword(string? password)
    {
        AssertSingleError(new LoginRequest(Email, password), "password", "Enter your password.");
    }

    [Fact]
    public void BothEmpty_ReturnsBothMessagesInFieldOrder()
    {
        var errors = LoginValidator.Validate(new LoginRequest("", ""));

        Assert.Equal(
            [
                new KeyValuePair<string, string>("email", "Enter your email address."),
                new KeyValuePair<string, string>("password", "Enter your password.")
            ],
            errors);
    }

    [Theory]
    [InlineData("   ")]
    [InlineData("a")]
    public void PasswordOfOnlySpacesOrShort_IsAccepted(string password)
    {
        Assert.Empty(LoginValidator.Validate(new LoginRequest(Email, password)));
    }

    [Fact]
    public void ValidDetails_ReturnNoErrors()
    {
        Assert.Empty(LoginValidator.Validate(new LoginRequest("  " + Email + "  ", Password)));
    }

    private static void AssertSingleError(LoginRequest request, string field, string message)
    {
        var error = Assert.Single(LoginValidator.Validate(request));
        Assert.Equal(new KeyValuePair<string, string>(field, message), error);
    }
}
