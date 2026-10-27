using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Checking the email and password (FR-001, FR-003, FR-004).</summary>
public class LoginServiceTests
{
    private const string Email = "user@example.com";
    private const string Password = "Password123!";

    [Fact]
    public async Task CorrectPassword_ReturnsSuccessWithTheUser()
    {
        using var host = new IdentityTestHost();
        var user = await host.CreateUserAsync(Email, Password);

        var result = await CreateService(host).LoginAsync(new LoginRequest(Email, Password));

        Assert.True(result.Succeeded);
        Assert.Equal(user.Id, result.User.Id);
    }

    [Theory]
    [InlineData("USER@Example.COM")]
    [InlineData("  user@example.com  ")]
    public async Task EmailInOtherCaseOrWithSpaces_ReturnsSuccess(string email)
    {
        using var host = new IdentityTestHost();
        await host.CreateUserAsync(Email, Password);

        var result = await CreateService(host).LoginAsync(new LoginRequest(email, Password));

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task UnknownEmail_ReturnsIncorrectCredentials()
    {
        using var host = new IdentityTestHost();
        await host.CreateUserAsync(Email, Password);

        var result = await CreateService(host).LoginAsync(new LoginRequest("other@example.com", Password));

        AssertIncorrectCredentials(result);
    }

    [Fact]
    public async Task WrongPassword_ReturnsIncorrectCredentials()
    {
        using var host = new IdentityTestHost();
        await host.CreateUserAsync(Email, Password);

        var result = await CreateService(host).LoginAsync(new LoginRequest(Email, "WrongPassword1!"));

        AssertIncorrectCredentials(result);
    }

    [Fact]
    public async Task PasswordIsNotTrimmed_TrailingSpaceDoesNotMatch()
    {
        using var host = new IdentityTestHost();
        await host.CreateUserAsync(Email, Password);
        await host.CreateUserAsync("spaced@example.com", Password + " ");
        var service = CreateService(host);

        AssertIncorrectCredentials(await service.LoginAsync(new LoginRequest(Email, Password + " ")));
        AssertIncorrectCredentials(await service.LoginAsync(new LoginRequest("spaced@example.com", Password)));
        Assert.True((await service.LoginAsync(new LoginRequest("spaced@example.com", Password + " "))).Succeeded);
    }

    [Theory]
    [InlineData(null, Password)]
    [InlineData("", Password)]
    [InlineData("   ", Password)]
    [InlineData(Email, null)]
    [InlineData(Email, "")]
    public async Task EmptyEmailOrPassword_ReturnsIncorrectCredentials(string? email, string? password)
    {
        using var host = new IdentityTestHost();
        await host.CreateUserAsync(Email, Password);

        var result = await CreateService(host).LoginAsync(new LoginRequest(email, password));

        AssertIncorrectCredentials(result);
    }

    [Fact]
    public async Task Login_NeverLogsThePassword()
    {
        using var host = new IdentityTestHost();
        await host.CreateUserAsync(Email, Password);
        var service = CreateService(host);

        await service.LoginAsync(new LoginRequest(Email, Password));
        await service.LoginAsync(new LoginRequest(Email, "WrongPassword1!"));

        Assert.DoesNotContain(host.LogEntries, entry => entry.Contains(Password) || entry.Contains("WrongPassword1!"));
    }

    private static LoginService CreateService(IdentityTestHost host) =>
        new(host.UserManager, host.SignInManager);

    private static void AssertIncorrectCredentials(LoginResult result)
    {
        Assert.False(result.Succeeded);
        Assert.True(result.IsIncorrectCredentials);
        Assert.Null(result.User);
    }
}
