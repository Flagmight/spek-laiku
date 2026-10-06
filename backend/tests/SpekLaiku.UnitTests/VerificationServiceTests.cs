using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

public class VerificationServiceTests
{
    [Fact]
    public async Task VerifyAsync_ValidToken_ActivatesAccountAndPreventsReuse()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var user = CreateUser();
        context.Users.Add(user);
        await context.SaveChangesAsync();
        var service = CreateService(userManager);
        var token = await service.CreateTokenAsync(user);

        var firstResult = await service.VerifyAsync(token);
        var secondResult = await service.VerifyAsync(token);

        Assert.True(firstResult.Succeeded);
        Assert.False(secondResult.Succeeded);
        Assert.Equal(AccountStatus.Active, user.AccountStatus);
        Assert.True(user.EmailConfirmed);
        Assert.NotNull(user.VerificationAttemptedAt);
    }

    [Fact]
    public async Task VerifyAsync_ExpiredToken_ReturnsFailure()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var user = CreateUser();
        context.Users.Add(user);
        await context.SaveChangesAsync();
        var protector = CreateProtector();
        var service = CreateService(userManager, protector);
        var identityToken = await userManager.GenerateEmailConfirmationTokenAsync(user);
        var expiredToken = protector.Protect($"{user.Id}\u001f{identityToken}\u001f{DateTime.UtcNow.AddHours(-2):O}");

        var result = await service.VerifyAsync(expiredToken);

        Assert.False(result.Succeeded);
        Assert.Equal("The verification link has expired.", result.ErrorMessage);
        Assert.Equal(AccountStatus.PendingVerification, user.AccountStatus);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static UserManager<ApplicationUser> CreateUserManager(ApplicationDbContext context)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(context);
        services.AddDataProtection().UseEphemeralDataProtectionProvider();
        services.AddIdentityCore<ApplicationUser>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddTokenProvider<DataProtectorTokenProvider<ApplicationUser>>("Default");
        var provider = services.BuildServiceProvider();
        return provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    private static VerificationService CreateService(
        UserManager<ApplicationUser> userManager,
        IDataProtector? protector = null)
    {
        protector ??= CreateProtector();
        return new VerificationService(userManager, protector, NullLogger<VerificationService>.Instance);
    }

    private static IDataProtector CreateProtector()
        => new EphemeralDataProtectionProvider().CreateProtector("SpekLaiku.Verification");

    private static ApplicationUser CreateUser() => new()
    {
        Id = Guid.NewGuid().ToString(),
        Email = "user@example.com",
        NormalizedEmail = "USER@EXAMPLE.COM",
        UserName = "user@example.com",
        NormalizedUserName = "USER@EXAMPLE.COM",
        AccountStatus = AccountStatus.PendingVerification,
        EmailConfirmed = false,
        RegistrationDate = DateTime.UtcNow
    };
}
