using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The plan places to the response objects in contracts/plan-places-api.md. The whole assembly's profiles are
/// loaded, as in the API, because the "HH:mm" conversion lives in <see cref="PlanForecastMappingProfile"/>.
/// </summary>
public sealed class PlanPlacesMappingTests : IDisposable
{
    private readonly ServiceProvider provider;
    private readonly IMapper mapper;

    public PlanPlacesMappingTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(PlanPlacesMappingProfile).Assembly);
        provider = services.BuildServiceProvider();
        mapper = provider.GetRequiredService<IMapper>();
    }

    [Fact]
    public void Configuration_IsValid()
    {
        mapper.ConfigurationProvider.AssertConfigurationIsValid();
    }

    [Fact]
    public void PlanPlaces_MapsEveryField()
    {
        var kayakingId = Guid.NewGuid();
        var museumId = Guid.NewGuid();
        var places = new PlanPlaces(
            new TimeOnly(14, 5, 59),
            30,
            [
                new CategoryPlaces(
                    kayakingId,
                    [
                        new NearbyPlace("Nemuno slipway", 54.89012, 23.9312, 3.4m, "Kaunas", "node/1"),
                        new NearbyPlace("Lampėdžių nuleidimo vieta", 54.9177, 23.8523, 4.1m, null, "way/2")
                    ]),
                new CategoryPlaces(museumId, [])
            ]);

        var response = mapper.Map<PlanPlacesResponse>(places);

        Assert.Equal("14:05", response.UpdatedAt);
        Assert.Equal(30, response.RadiusKm);
        Assert.Equal([kayakingId, museumId], response.Categories.Select(category => category.CategoryId));
        Assert.Equal(
            [
                new NearbyPlaceResponse("Nemuno slipway", 54.89012, 23.9312, 3.4m, "Kaunas"),
                new NearbyPlaceResponse("Lampėdžių nuleidimo vieta", 54.9177, 23.8523, 4.1m, null)
            ],
            response.Categories[0].Places);
        Assert.Empty(response.Categories[1].Places);
    }

    [Fact]
    public void PlaceResponse_HasNoFieldForTheMapElementsKey()
    {
        Assert.Equal(
            ["Name", "Latitude", "Longitude", "DistanceKm", "Area"],
            typeof(NearbyPlaceResponse).GetProperties().Select(property => property.Name));
    }

    public void Dispose() => provider.Dispose();
}
