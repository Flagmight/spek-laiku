using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Services;
using static SpekLaiku.UnitTests.RegistrationServiceTests;

namespace SpekLaiku.UnitTests;

/// <summary>Every FR-010 message, the FR-003 email rule and the FR-005 password rule.</summary>
public class RegistrationValidationTests
{
    private const string Password = "Password123!";
    private const string InvalidEmail = "Enter a valid email address.";

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task EmptyEmail_ReturnsEnterYourEmail(string? email)
    {
        await AssertSingleErrorAsync(
            new RegistrationRequest(email, Password, Password), "email", "Enter your email address.");
    }

    [Theory]
    [InlineData("a@b")]
    [InlineData("a@b.")]
    [InlineData("@b.lt")]
    [InlineData("a b@c.lt")]
    [InlineData("a@@b.lt")]
    [InlineData("a@b@c.lt")]
    [InlineData("a@.lt")]
    [InlineData("userexample.com")]
    public async Task InvalidEmailFormat_ReturnsEnterValidEmail(string email)
    {
        await AssertSingleErrorAsync(new RegistrationRequest(email, Password, Password), "email", InvalidEmail);
    }

    [Fact]
    public async Task EmailLongerThan254Characters_ReturnsEnterValidEmail()
    {
        var email = new string('a', 243) + "@example.com";
        Assert.Equal(255, email.Length);

        await AssertSingleErrorAsync(new RegistrationRequest(email, Password, Password), "email", InvalidEmail);
    }

    [Theory]
    [InlineData("o'brien@example.com")]
    [InlineData("first.last+tag@sub.example.lt")]
    [InlineData("  spaced@example.com  ")]
    public async Task UncommonButValidEmail_CreatesAccount(string email)
    {
        await AssertCreatedAsync(new RegistrationRequest(email, Password, Password));
    }

    [Fact]
    public async Task EmailOfExactly254Characters_CreatesAccount()
    {
        var email = new string('a', 242) + "@example.com";
        Assert.Equal(254, email.Length);

        await AssertCreatedAsync(new RegistrationRequest(email, Password, Password));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task EmptyPassword_ReturnsEnterAPassword(string? password)
    {
        await AssertSingleErrorAsync(
            new RegistrationRequest("user@example.com", password, "Password123!"),
            "password",
            "Enter a password.",
            alsoAllowed: "passwordConfirmation");
    }

    [Theory]
    [InlineData("a")]
    [InlineData("abcdefg")]
    [InlineData("       ")]
    public async Task PasswordShorterThan8Characters_ReturnsMinimumLengthMessage(string password)
    {
        await AssertSingleErrorAsync(
            new RegistrationRequest("user@example.com", password, password),
            "password",
            "Password must be at least 8 characters.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task EmptyConfirmation_ReturnsConfirmYourPassword(string? confirmation)
    {
        await AssertSingleErrorAsync(
            new RegistrationRequest("user@example.com", Password, confirmation),
            "passwordConfirmation",
            "Confirm your password.");
    }

    [Theory]
    [InlineData("Password123?")]
    [InlineData("password123!")]
    [InlineData("Password123! ")]
    public async Task MismatchedConfirmation_ReturnsPasswordsDoNotMatch(string confirmation)
    {
        await AssertSingleErrorAsync(
            new RegistrationRequest("user@example.com", Password, confirmation),
            "passwordConfirmation",
            "Passwords do not match.");
    }

    [Theory]
    [InlineData(8)]
    [InlineData(200)]
    [InlineData(1000)]
    public async Task PasswordOf8OrMoreCharacters_CreatesAccount(int length)
    {
        var password = new string('p', length);

        await AssertCreatedAsync(new RegistrationRequest("user@example.com", password, password));
    }

    [Fact]
    public async Task PasswordWithSpacesAroundIt_IsStoredExactlyAsEntered()
    {
        const string password = "  abcdef";
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);

        var result = await service.RegisterAsync(new RegistrationRequest("user@example.com", password, password));

        Assert.True(result.Succeeded);
        var user = await userManager.Users.SingleAsync();
        Assert.True(await userManager.CheckPasswordAsync(user, password));
        Assert.False(await userManager.CheckPasswordAsync(user, password.Trim()));
    }

    [Fact]
    public async Task AllFieldsEmpty_ReturnsEveryEmptyMessageInContractOrder()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);

        var result = await service.RegisterAsync(new RegistrationRequest(null, null, null));

        Assert.Equal(
            [
                new("email", "Enter your email address."),
                new("password", "Enter a password."),
                new KeyValuePair<string, string>("passwordConfirmation", "Confirm your password.")
            ],
            result.Errors);
        Assert.Empty(await userManager.Users.ToListAsync());
    }

    // Checks the one expected message, that no account is created, and that no other field fails
    // (except alsoAllowed, for requests where a second message is unavoidable).
    private static async Task AssertSingleErrorAsync(
        RegistrationRequest request, string field, string message, string? alsoAllowed = null)
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);

        var result = await service.RegisterAsync(request);

        Assert.False(result.Succeeded);
        Assert.False(result.IsTechnicalFailure);
        Assert.Equal(message, result.Errors[field]);
        Assert.All(result.Errors.Keys, key => Assert.True(key == field || key == alsoAllowed, key));
        Assert.Empty(await userManager.Users.ToListAsync());
    }

    private static async Task AssertCreatedAsync(RegistrationRequest request)
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);

        var result = await service.RegisterAsync(request);

        Assert.True(result.Succeeded, string.Join(", ", result.Errors.Values));
        Assert.False(result.IsTechnicalFailure);
        Assert.Single(await userManager.Users.ToListAsync());
    }
}
