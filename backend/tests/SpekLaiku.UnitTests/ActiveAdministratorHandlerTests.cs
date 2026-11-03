using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.UnitTests;

/// <summary>Only an Active Administrator meets the category management requirement (spec FR-016 to FR-019).</summary>
public sealed class ActiveAdministratorHandlerTests : IDisposable
{
    private const string Password = "Password123!";

    private readonly IdentityTestHost host = new();

    [Fact]
    public async Task ActiveAdministrator_Succeeds()
    {
        var principal = await CreatePrincipalAsync("Administrator", AccountStatus.Active);

        Assert.True(await HandleAsync(principal));
    }

    [Theory]
    [InlineData("Registered User", AccountStatus.Active)]
    [InlineData("Registered User", AccountStatus.Suspended)]
    [InlineData("Administrator", AccountStatus.Suspended)]
    public async Task OtherAccount_DoesNotSucceed(string role, AccountStatus status)
    {
        var principal = await CreatePrincipalAsync(role, status);

        Assert.False(await HandleAsync(principal));
    }

    [Fact]
    public async Task AccountDeletedAfterSignIn_DoesNotSucceed()
    {
        var user = await host.CreateUserAsync($"{Guid.NewGuid():N}@example.com", Password, "Administrator");
        var principal = await host.SignInManager.CreateUserPrincipalAsync(user);
        await host.UserManager.DeleteAsync(user);

        Assert.False(await HandleAsync(principal));
    }

    [Fact]
    public async Task AnonymousPrincipal_DoesNotSucceed()
    {
        Assert.False(await HandleAsync(new ClaimsPrincipal(new ClaimsIdentity())));
    }

    [Fact]
    public async Task AccountSuspendedAfterSignIn_DoesNotSucceed()
    {
        var user = await host.CreateUserAsync($"{Guid.NewGuid():N}@example.com", Password, "Administrator");
        var principal = await host.SignInManager.CreateUserPrincipalAsync(user);
        user.AccountStatus = AccountStatus.Suspended;
        await host.UserManager.UpdateAsync(user);

        Assert.False(await HandleAsync(principal));
    }

    public void Dispose() => host.Dispose();

    private async Task<ClaimsPrincipal> CreatePrincipalAsync(string role, AccountStatus status)
    {
        var user = await host.CreateUserAsync($"{Guid.NewGuid():N}@example.com", Password, role, status);
        return await host.SignInManager.CreateUserPrincipalAsync(user);
    }

    private async Task<bool> HandleAsync(ClaimsPrincipal principal)
    {
        var requirement = new ActiveAdministratorRequirement();
        var context = new AuthorizationHandlerContext([requirement], principal, resource: null);

        await new ActiveAdministratorHandler(host.UserManager).HandleAsync(context);

        return context.HasSucceeded;
    }
}
