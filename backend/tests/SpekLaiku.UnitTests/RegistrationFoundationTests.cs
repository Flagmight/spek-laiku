using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

public class RegistrationFoundationTests
{
    [Fact]
    public void ApplicationUserModel_StoresPendingStatusAndEnforcesNormalizedEmailUniqueness()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        using var context = new ApplicationDbContext(options);
        var entityType = context.Model.FindEntityType(typeof(ApplicationUser))!;
        var status = entityType.FindProperty(nameof(ApplicationUser.AccountStatus))!;
        var emailIndex = entityType.GetIndexes()
            .Single(index => index.Properties.Single().Name == nameof(ApplicationUser.NormalizedEmail));

        Assert.Equal(AccountStatus.PendingVerification, status.GetDefaultValue());
        Assert.True(emailIndex.IsUnique);
        Assert.Equal(254, entityType.FindProperty(nameof(ApplicationUser.Email))!.GetMaxLength());
    }

    [Fact]
    public void RegistrationMappingProfile_MapsResponsesWithoutSensitiveProperties()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(RegistrationMappingProfile).Assembly);
        using var provider = services.BuildServiceProvider();
        var mapper = provider.GetRequiredService<IMapper>();

        mapper.ConfigurationProvider.AssertConfigurationIsValid();
        var success = mapper.Map<RegistrationResponse>(new RegistrationResult(true));
        var failure = mapper.Map<RegistrationResponse>(
            new RegistrationResult(false, "This email is already registered."));

        Assert.Equal("PendingVerification", success.AccountStatus);
        Assert.Equal("Account created. Verify your email to continue.", success.Message);
        Assert.Null(failure.AccountStatus);
        Assert.Equal("This email is already registered.", failure.Message);
    }
}
