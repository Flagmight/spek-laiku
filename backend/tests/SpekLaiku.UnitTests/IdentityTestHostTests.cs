using SpekLaiku.Api.Entities;

namespace SpekLaiku.UnitTests;

/// <summary>Checks that the login test host gives working Identity managers.</summary>
public class IdentityTestHostTests
{
    [Fact]
    public async Task CreatedUser_PassesPasswordCheck()
    {
        using var host = new IdentityTestHost();
        var user = await host.CreateUserAsync("user@example.com", "Password123!");

        var result = await host.SignInManager.CheckPasswordSignInAsync(user, "Password123!", lockoutOnFailure: false);

        Assert.True(result.Succeeded);
        Assert.Equal("Registered User", user.Role);
        Assert.Equal(AccountStatus.Active, user.AccountStatus);
    }
}
