using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

public class RegistrationServiceTests
{
    [Fact]
    public async Task RegisterAsync_CreatesActiveRegisteredUser()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);

        var result = await service.RegisterAsync(new RegistrationRequest(
            "  USER@EXAMPLE.COM  ", "Password123!", "Password123!"));

        Assert.True(result.Succeeded);
        var user = await userManager.Users.SingleAsync();
        Assert.Equal("USER@EXAMPLE.COM", user.Email);
        Assert.Equal(AccountStatus.Active, user.AccountStatus);
        Assert.Equal("Registered User", user.Role);
    }

    [Fact]
    public async Task RegisterAsync_DuplicateEmailCaseInsensitive_ReturnsDuplicateError()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);
        await service.RegisterAsync(new RegistrationRequest("user@example.com", "Password123!", "Password123!"));

        var result = await service.RegisterAsync(new RegistrationRequest("USER@EXAMPLE.COM", "Password123!", "Password123!"));

        Assert.False(result.Succeeded);
        Assert.Equal("This email is already registered.", result.ErrorMessage);
        Assert.Single(await userManager.Users.ToListAsync());
    }

    [Fact]
    public async Task RegisterAsync_ShortPassword_ReturnsValidationErrorWithoutCreatingAccount()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);

        var result = await service.RegisterAsync(
            new RegistrationRequest("user@example.com", "short", "short"));

        Assert.False(result.Succeeded);
        Assert.Equal("Password must be at least 8 characters.", result.ErrorMessage);
        Assert.Empty(await userManager.Users.ToListAsync());
    }

    [Fact]
    public async Task RegisterAsync_MismatchedPassword_ReturnsValidationErrorWithoutCreatingAccount()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);

        var result = await service.RegisterAsync(
            new RegistrationRequest("user@example.com", "Password123!", "Different123!"));

        Assert.False(result.Succeeded);
        Assert.Equal("Passwords do not match.", result.ErrorMessage);
        Assert.Empty(await userManager.Users.ToListAsync());
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
        services.AddIdentityCore<ApplicationUser>()
            .AddEntityFrameworkStores<ApplicationDbContext>();
        return services.BuildServiceProvider().GetRequiredService<UserManager<ApplicationUser>>();
    }
}
