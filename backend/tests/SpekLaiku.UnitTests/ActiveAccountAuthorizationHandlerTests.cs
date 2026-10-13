using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.UnitTests;

public class ActiveAccountAuthorizationHandlerTests
{
    [Fact]
    public async Task HandleRequirementAsync_ActiveConfirmedUser_Succeeds()
    {
        var result = await AuthorizeAsync(AccountStatus.Active, emailConfirmed: true);

        Assert.True(result);
    }

    [Theory]
    [InlineData(AccountStatus.PendingVerification, true)]
    [InlineData(AccountStatus.Suspended, true)]
    [InlineData(AccountStatus.Active, false)]
    public async Task HandleRequirementAsync_UserNotActiveAndConfirmed_DoesNotSucceed(
        AccountStatus status,
        bool emailConfirmed)
    {
        var result = await AuthorizeAsync(status, emailConfirmed);

        Assert.False(result);
    }

    private static async Task<bool> AuthorizeAsync(AccountStatus status, bool emailConfirmed)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var context = new ApplicationDbContext(options);
        using var services = new ServiceCollection()
            .AddLogging()
            .AddSingleton(context)
            .AddIdentityCore<ApplicationUser>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .Services
            .BuildServiceProvider();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid().ToString(),
            UserName = "user@example.com",
            NormalizedUserName = "USER@EXAMPLE.COM",
            Email = "user@example.com",
            NormalizedEmail = "USER@EXAMPLE.COM",
            AccountStatus = status,
            EmailConfirmed = emailConfirmed
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, user.Id)],
            authenticationType: "test"));
        var requirement = new ActiveAccountRequirement();
        var authorizationContext = new AuthorizationHandlerContext([requirement], principal, resource: null);
        var handler = new ActiveAccountAuthorizationHandler(userManager);

        await handler.HandleAsync(authorizationContext);
        return authorizationContext.HasSucceeded;
    }
}
