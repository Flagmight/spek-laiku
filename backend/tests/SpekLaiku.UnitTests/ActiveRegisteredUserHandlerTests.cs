using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.UnitTests;

/// <summary>Only a signed-in, Active Registered User may save, list and open plans (feature 010 spec FR-012).</summary>
public sealed class ActiveRegisteredUserHandlerTests : IDisposable
{
    private const string Password = "Password123!";

    private readonly IdentityTestHost host = new();

    [Fact]
    public async Task ActiveRegisteredUser_Succeeds()
    {
        var principal = await CreatePrincipalAsync("Registered User", AccountStatus.Active);

        Assert.True(await HandleAsync(principal));
    }

    [Fact]
    public async Task Visitor_DoesNotSucceed()
    {
        Assert.False(await HandleAsync(new ClaimsPrincipal(new ClaimsIdentity())));
    }

    [Theory]
    [InlineData("Registered User", AccountStatus.Suspended)]
    [InlineData("Administrator", AccountStatus.Active)]
    [InlineData("Administrator", AccountStatus.Suspended)]
    public async Task OtherSignedInAccount_DoesNotSucceed(string role, AccountStatus status)
    {
        var principal = await CreatePrincipalAsync(role, status);

        Assert.False(await HandleAsync(principal));
    }

    [Fact]
    public async Task AccountDeletedAfterSignIn_DoesNotSucceed()
    {
        var user = await host.CreateUserAsync($"{Guid.NewGuid():N}@example.com", Password, "Registered User");
        var principal = await host.SignInManager.CreateUserPrincipalAsync(user);
        await host.UserManager.DeleteAsync(user);

        Assert.False(await HandleAsync(principal));
    }

    [Fact]
    public async Task AccountSuspendedAfterSignIn_DoesNotSucceed()
    {
        var user = await host.CreateUserAsync($"{Guid.NewGuid():N}@example.com", Password, "Registered User");
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
        var requirement = new ActiveRegisteredUserRequirement();
        var context = new AuthorizationHandlerContext([requirement], principal, resource: null);

        await new ActiveRegisteredUserHandler(host.UserManager).HandleAsync(context);

        return context.HasSucceeded;
    }
}
