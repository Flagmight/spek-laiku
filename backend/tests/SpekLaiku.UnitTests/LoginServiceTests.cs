using Microsoft.Extensions.Logging;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Checking the email and password, and the lockout (FR-001 to FR-005, FR-026, FR-027).</summary>
public class LoginServiceTests
{
    private const string Email = "user@example.com";
    private const string Password = "Password123!";
    private const string WrongPassword = "WrongPassword1!";
    private static readonly string ServiceCategory = typeof(LoginService).FullName!;

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

        var result = await CreateService(host).LoginAsync(new LoginRequest(Email, WrongPassword));

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
    [InlineData("", Password, "email")]
    [InlineData("not-an-email", Password, "email")]
    [InlineData(Email, "", "password")]
    public async Task InvalidFields_ReturnInvalidWithoutCountingAnAttempt(string email, string password, string field)
    {
        using var host = new IdentityTestHost();
        var user = await host.CreateUserAsync(Email, Password);

        var result = await CreateService(host).LoginAsync(new LoginRequest(email, password));

        Assert.False(result.Succeeded);
        Assert.False(result.IsIncorrectCredentials);
        Assert.Equal([field], result.Errors.Keys);
        Assert.Equal(0, await host.UserManager.GetAccessFailedCountAsync(user));
    }

    [Fact]
    public async Task FifthWrongPasswordInARow_LocksTheAccount()
    {
        using var host = new IdentityTestHost();
        var user = await host.CreateUserAsync(Email, Password);
        var service = CreateService(host);

        for (var attempt = 1; attempt <= 4; attempt++)
        {
            AssertIncorrectCredentials(await service.LoginAsync(new LoginRequest(Email, WrongPassword)));
            Assert.False(await host.UserManager.IsLockedOutAsync(user));
        }

        AssertIncorrectCredentials(await service.LoginAsync(new LoginRequest(Email, WrongPassword)));

        Assert.True(await host.UserManager.IsLockedOutAsync(user));
        var lockoutEnd = await host.UserManager.GetLockoutEndDateAsync(user);
        Assert.InRange(
            lockoutEnd!.Value,
            DateTimeOffset.UtcNow.AddMinutes(14),
            DateTimeOffset.UtcNow.AddMinutes(15));
    }

    [Fact]
    public async Task LockedAccount_ReturnsIncorrectCredentialsWithTheCorrectPassword()
    {
        using var host = new IdentityTestHost();
        await host.CreateUserAsync(Email, Password);
        var service = CreateService(host);
        await FailFiveTimesAsync(service);

        var result = await service.LoginAsync(new LoginRequest(Email, Password));

        AssertIncorrectCredentials(result);
    }

    [Fact]
    public async Task Lock_WritesOneWarningWithTheAccountIdOnly()
    {
        using var host = new IdentityTestHost();
        var user = await host.CreateUserAsync(Email, Password);
        var service = CreateService(host);

        await FailFiveTimesAsync(service);
        await service.LoginAsync(new LoginRequest(Email, Password));
        await service.LoginAsync(new LoginRequest(Email, WrongPassword));

        var entry = Assert.Single(ServiceLogEntries(host));
        Assert.Contains($"{LogLevel.Warning}:", entry);
        Assert.Contains(user.Id, entry);
        Assert.DoesNotContain(Email, entry, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(Password, entry);
        Assert.DoesNotContain(WrongPassword, entry);
    }

    [Fact]
    public async Task SuccessfulAndFailedLogins_WriteNoLogEntry()
    {
        using var host = new IdentityTestHost();
        await host.CreateUserAsync(Email, Password);
        var service = CreateService(host);

        await service.LoginAsync(new LoginRequest(Email, Password));
        await service.LoginAsync(new LoginRequest(Email, WrongPassword));
        await service.LoginAsync(new LoginRequest("other@example.com", Password));

        Assert.Empty(ServiceLogEntries(host));
    }

    [Fact]
    public async Task Login_NeverLogsThePassword()
    {
        using var host = new IdentityTestHost();
        await host.CreateUserAsync(Email, Password);
        var service = CreateService(host);

        await service.LoginAsync(new LoginRequest(Email, Password));
        await FailFiveTimesAsync(service);

        Assert.DoesNotContain(host.LogEntries, entry => entry.Contains(Password) || entry.Contains(WrongPassword));
    }

    [Fact]
    public async Task SuccessfulLogin_ResetsTheFailedAttemptCount()
    {
        using var host = new IdentityTestHost();
        var user = await host.CreateUserAsync(Email, Password);
        var service = CreateService(host);
        await service.LoginAsync(new LoginRequest(Email, WrongPassword));
        await service.LoginAsync(new LoginRequest(Email, WrongPassword));
        Assert.Equal(2, await host.UserManager.GetAccessFailedCountAsync(user));

        Assert.True((await service.LoginAsync(new LoginRequest(Email, Password))).Succeeded);

        Assert.Equal(0, await host.UserManager.GetAccessFailedCountAsync(user));
    }

    [Fact]
    public async Task Lock_DoesNotChangeAccountStatus()
    {
        using var host = new IdentityTestHost();
        var user = await host.CreateUserAsync(Email, Password);

        await FailFiveTimesAsync(CreateService(host));

        Assert.True(await host.UserManager.IsLockedOutAsync(user));
        Assert.Equal(AccountStatus.Active, (await host.UserManager.FindByIdAsync(user.Id))!.AccountStatus);
    }

    private static LoginService CreateService(IdentityTestHost host) =>
        new(host.UserManager, host.SignInManager, host.LoggerFactory.CreateLogger<LoginService>());

    private static async Task FailFiveTimesAsync(LoginService service)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            await service.LoginAsync(new LoginRequest(Email, WrongPassword));
        }
    }

    // Identity and EF Core write their own debug entries; only the service's own entries are checked here.
    private static List<string> ServiceLogEntries(IdentityTestHost host) =>
        host.LogEntries.Where(entry => entry.StartsWith(ServiceCategory + " ", StringComparison.Ordinal)).ToList();

    private static void AssertIncorrectCredentials(LoginResult result)
    {
        Assert.False(result.Succeeded);
        Assert.True(result.IsIncorrectCredentials);
        Assert.Null(result.User);
    }
}
