using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

public class RegistrationServiceTests
{
    [Fact]
    public async Task RegisterAsync_CreatesPendingVerificationUserAndSendsConfirmation()
    {
        await using var context = CreateContext();
        var (userManager, protector) = CreateIdentityServices(context);
        var sender = new FakeEmailSender();
        var verificationService = new VerificationService(userManager, protector, NullLogger<VerificationService>.Instance);
        var service = new RegistrationService(userManager, emailSender: sender, verificationService);

        var result = await service.RegisterAsync(new RegistrationRequest(
            "  USER@EXAMPLE.COM  ", "Password123!", "Password123!"));

        Assert.True(result.Succeeded);
        var user = await userManager.Users.SingleAsync();
        Assert.Equal("USER@EXAMPLE.COM", user.Email);
        Assert.Equal(AccountStatus.PendingVerification, user.AccountStatus);
        Assert.False(user.EmailConfirmed);
        Assert.Equal("Registered User", user.Role);
        Assert.Equal(1, sender.SentCount);
        Assert.NotNull(user.VerificationSentAt);
    }

    [Fact]
    public async Task RegisterAsync_DuplicateEmailCaseInsensitive_ReturnsDuplicateError()
    {
        await using var context = CreateContext();
        var (userManager, _) = CreateIdentityServices(context);
        var verificationService = new VerificationService(userManager, CreateProtector(), NullLogger<VerificationService>.Instance);
        var service = new RegistrationService(userManager, new FakeEmailSender(), verificationService);
        await service.RegisterAsync(new RegistrationRequest("user@example.com", "Password123!", "Password123!"));

        var result = await service.RegisterAsync(new RegistrationRequest("USER@EXAMPLE.COM", "Password123!", "Password123!"));

        Assert.False(result.Succeeded);
        Assert.Equal("This email is already registered.", result.ErrorMessage);
        Assert.Single(await userManager.Users.ToListAsync());
    }

    [Fact]
    public async Task RegisterAsync_EmailSenderFailure_RemovesIncompleteAccount()
    {
        await using var context = CreateContext();
        var (userManager, _) = CreateIdentityServices(context);
        var verificationService = new VerificationService(userManager, CreateProtector(), NullLogger<VerificationService>.Instance);
        var service = new RegistrationService(userManager, new FailingEmailSender(), verificationService);

        var result = await service.RegisterAsync(new RegistrationRequest("user@example.com", "Password123!", "Password123!"));

        Assert.False(result.Succeeded);
        Assert.Equal("Account could not be created. Try again later.", result.ErrorMessage);
        Assert.Empty(await userManager.Users.ToListAsync());
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static (UserManager<ApplicationUser> UserManager, IDataProtector Protector) CreateIdentityServices(ApplicationDbContext context)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(context);
        services.AddDataProtection().UseEphemeralDataProtectionProvider();
        services.AddIdentityCore<ApplicationUser>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddTokenProvider<DataProtectorTokenProvider<ApplicationUser>>("Default");
        var provider = services.BuildServiceProvider();
        var dataProtectionProvider = provider.GetRequiredService<IDataProtectionProvider>();
        return (
            provider.GetRequiredService<UserManager<ApplicationUser>>(),
            dataProtectionProvider.CreateProtector("SpekLaiku.Verification"));
    }

    private static IDataProtector CreateProtector()
        => new EphemeralDataProtectionProvider().CreateProtector("SpekLaiku.Verification");

    private sealed class FakeEmailSender : IEmailSender
    {
        public int SentCount { get; private set; }

        public Task SendEmailConfirmationAsync(ApplicationUser user, string token, CancellationToken cancellationToken = default)
        {
            SentCount++;
            return Task.CompletedTask;
        }
    }

    private sealed class FailingEmailSender : IEmailSender
    {
        public Task SendEmailConfirmationAsync(ApplicationUser user, string token, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("Email unavailable");
    }
}
