using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

public class RegistrationServiceTests
{
    private const string DuplicateMessage = "This email is already registered.";

    [Fact]
    public async Task RegisterAsync_ValidDetails_CreatesActiveRegisteredUserWithTrimmedEmail()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);
        var before = DateTime.UtcNow;

        var result = await service.RegisterAsync(new RegistrationRequest(
            "  USER@EXAMPLE.COM  ", "Password123!", "Password123!"));

        Assert.True(result.Succeeded);
        Assert.Empty(result.Errors);
        var user = await userManager.Users.SingleAsync();
        Assert.Equal(user.Id, result.User.Id);
        Assert.Equal("USER@EXAMPLE.COM", user.Email);
        Assert.Equal("USER@EXAMPLE.COM", user.UserName);
        Assert.Equal(AccountStatus.Active, user.AccountStatus);
        Assert.Equal("Registered User", user.Role);
        Assert.NotEqual("Administrator", user.Role);
        Assert.Equal(DateTimeKind.Utc, user.RegistrationDate.Kind);
        Assert.InRange(user.RegistrationDate, before, DateTime.UtcNow);
    }

    [Theory]
    [InlineData("user@example.com")]
    [InlineData("USER@EXAMPLE.COM")]
    [InlineData("User@Example.Com")]
    [InlineData("  uSeR@example.com  ")]
    public async Task RegisterAsync_DuplicateEmailInAnyCase_ReturnsDuplicateErrorAndKeepsOneAccount(string secondEmail)
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);
        await service.RegisterAsync(new RegistrationRequest("user@example.com", "Password123!", "Password123!"));

        var result = await service.RegisterAsync(new RegistrationRequest(secondEmail, "Password123!", "Password123!"));

        Assert.False(result.Succeeded);
        Assert.False(result.IsTechnicalFailure);
        Assert.Equal(DuplicateMessage, Assert.Single(result.Errors, error => error.Key == "email").Value);
        Assert.Single(await userManager.Users.ToListAsync());
    }

    [Fact]
    public async Task RegisterAsync_AccountCreationFails_ReturnsTechnicalFailureAndLeavesNoAccount()
    {
        await using var context = CreateContext();
        var service = new RegistrationService(new TestUserManager(
            context, () => throw new DbUpdateException("Saving the user failed.")));

        var result = await service.RegisterAsync(ValidRequest());

        Assert.False(result.Succeeded);
        Assert.True(result.IsTechnicalFailure);
        Assert.Empty(result.Errors);
        Assert.Empty(await context.Users.ToListAsync());
    }

    [Theory]
    [InlineData("EmailIndex")]
    [InlineData("UserNameIndex")]
    public async Task RegisterAsync_UniqueIndexViolation_ReturnsDuplicateError(string constraintName)
    {
        await using var context = CreateContext();
        var service = new RegistrationService(new TestUserManager(
            context, () => throw DatabaseError(PostgresErrorCodes.UniqueViolation, constraintName)));

        var result = await service.RegisterAsync(ValidRequest());

        Assert.False(result.IsTechnicalFailure);
        Assert.Equal(DuplicateMessage, Assert.Single(result.Errors, error => error.Key == "email").Value);
    }

    [Fact]
    public async Task RegisterAsync_OtherDatabaseError_ReturnsTechnicalFailure()
    {
        await using var context = CreateContext();
        var service = new RegistrationService(new TestUserManager(
            context, () => throw DatabaseError(PostgresErrorCodes.NotNullViolation, "EmailIndex")));

        var result = await service.RegisterAsync(ValidRequest());

        Assert.False(result.Succeeded);
        Assert.True(result.IsTechnicalFailure);
        Assert.Empty(result.Errors);
    }

    [Theory]
    [InlineData("DuplicateEmail")]
    [InlineData("DuplicateUserName")]
    public async Task RegisterAsync_IdentityDuplicateFailure_ReturnsDuplicateError(string errorCode)
    {
        await using var context = CreateContext();
        var service = new RegistrationService(new TestUserManager(
            context, () => IdentityResult.Failed(new IdentityError { Code = errorCode })));

        var result = await service.RegisterAsync(ValidRequest());

        Assert.False(result.IsTechnicalFailure);
        Assert.Equal(DuplicateMessage, Assert.Single(result.Errors, error => error.Key == "email").Value);
    }

    [Fact]
    public async Task RegisterAsync_OtherIdentityFailure_ReturnsTechnicalFailure()
    {
        await using var context = CreateContext();
        var service = new RegistrationService(new TestUserManager(
            context, () => IdentityResult.Failed(new IdentityError { Code = "InvalidUserName" })));

        var result = await service.RegisterAsync(ValidRequest());

        Assert.False(result.Succeeded);
        Assert.True(result.IsTechnicalFailure);
        Assert.Empty(result.Errors);
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
        Assert.Equal("Password must be at least 8 characters.", result.Errors["password"]);
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
        Assert.Equal("Passwords do not match.", result.Errors["passwordConfirmation"]);
        Assert.Empty(await userManager.Users.ToListAsync());
    }

    [Fact]
    public async Task RegisterAsync_SeveralInvalidFields_ReturnsEveryFieldInContractOrder()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);

        var result = await service.RegisterAsync(new RegistrationRequest(null, "short", "Different"));

        Assert.False(result.Succeeded);
        Assert.Equal(
            [
                new("email", "Enter your email address."),
                new("password", "Password must be at least 8 characters."),
                new KeyValuePair<string, string>("passwordConfirmation", "Passwords do not match.")
            ],
            result.Errors);
        Assert.Empty(await userManager.Users.ToListAsync());
    }

    [Fact]
    public async Task RegisterAsync_RegisteredEmailWithOtherInvalidField_ReturnsOnlyTheFieldError()
    {
        await using var context = CreateContext();
        var userManager = CreateUserManager(context);
        var service = new RegistrationService(userManager);
        await service.RegisterAsync(ValidRequest());

        var result = await service.RegisterAsync(new RegistrationRequest("user@example.com", "Password123!", ""));

        Assert.Equal(
            [new KeyValuePair<string, string>("passwordConfirmation", "Confirm your password.")],
            result.Errors);
    }

    private static RegistrationRequest ValidRequest() =>
        new("user@example.com", "Password123!", "Password123!");

    private static DbUpdateException DatabaseError(string sqlState, string constraintName) =>
        new("Saving the user failed.", new PostgresException(
            "Database error.", "ERROR", "ERROR", sqlState, constraintName: constraintName));

    internal static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    internal static UserManager<ApplicationUser> CreateUserManager(ApplicationDbContext context)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(context);
        services.AddIdentityCore<ApplicationUser>(IdentityOptionsSetup.Configure)
            .AddEntityFrameworkStores<ApplicationDbContext>();
        return services.BuildServiceProvider().GetRequiredService<UserManager<ApplicationUser>>();
    }
}
