using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Plan setup results map to the objects in contracts/plan-setup-api.md.</summary>
public sealed class PlanSetupMappingTests : IDisposable
{
    private static readonly PlaceLocation Kaunas = new(598316, "Kaunas", "Kaunas County", 54.90156, 23.90909);

    private readonly ServiceProvider provider;
    private readonly IMapper mapper;

    public PlanSetupMappingTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(PlanSetupMappingProfile).Assembly);
        provider = services.BuildServiceProvider();
        mapper = provider.GetRequiredService<IMapper>();
    }

    [Fact]
    public void Configuration_IsValid()
    {
        mapper.ConfigurationProvider.AssertConfigurationIsValid();
    }

    [Fact]
    public void PlaceLocation_MapsEveryField()
    {
        var response = mapper.Map<LocationResponse>(Kaunas);

        Assert.Equal(new LocationResponse(598316, "Kaunas", "Kaunas County", 54.90156, 23.90909), response);
    }

    [Fact]
    public void CheckedPlanSetup_MapsLocationDatesAndDistance()
    {
        var setup = new CheckedPlanSetup(Kaunas, [new DateOnly(2026, 11, 7), new DateOnly(2026, 11, 8)], 30);

        var response = mapper.Map<CheckedPlanSetupResponse>(setup);

        Assert.Equal(new LocationResponse(598316, "Kaunas", "Kaunas County", 54.90156, 23.90909), response.Location);
        Assert.Equal([new DateOnly(2026, 11, 7), new DateOnly(2026, 11, 8)], response.Dates);
        Assert.Equal(30, response.MaxTravelDistanceKm);
    }

    public void Dispose() => provider.Dispose();
}
