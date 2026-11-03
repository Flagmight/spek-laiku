using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Mapping;

namespace SpekLaiku.UnitTests;

/// <summary>The category entity maps to the category object in contracts/categories-api.md.</summary>
public sealed class ActivityCategoryMappingTests : IDisposable
{
    private readonly ServiceProvider provider;
    private readonly IMapper mapper;

    public ActivityCategoryMappingTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(ActivityCategoryMappingProfile).Assembly);
        provider = services.BuildServiceProvider();
        mapper = provider.GetRequiredService<IMapper>();
    }

    [Fact]
    public void Configuration_IsValid()
    {
        mapper.ConfigurationProvider.AssertConfigurationIsValid();
    }

    [Fact]
    public void OutdoorCategory_MapsEveryField()
    {
        var id = Guid.NewGuid();
        var category = new ActivityCategory
        {
            Id = id,
            Name = "Kayaking",
            NormalizedName = "KAYAKING",
            Type = ActivityType.Outdoor,
            DefaultDurationHours = 2.0m,
            RequiresDaylight = true,
            MaxWindMs = 8.0m,
            MaxRainMmPerHour = 0.5m,
            MinTemperatureC = 15.0m,
            MaxTemperatureC = 35.0m,
            PlaceTags = ["leisure=slipway", "sport=canoe"],
            Version = 1042
        };

        var response = mapper.Map<ActivityCategoryResponse>(category);

        // Record equality compares the tag list by reference, so the list is checked separately below.
        Assert.Equal(
            new ActivityCategoryResponse(
                id, "Kayaking", "Outdoor", 2.0m, true, 8.0m, 0.5m, 15.0m, 35.0m, response.PlaceTags, 1042),
            response);
        Assert.Equal(["leisure=slipway", "sport=canoe"], response.PlaceTags);
    }

    [Fact]
    public void IndoorCategory_MapsTypeNameAndNullLimits()
    {
        var category = new ActivityCategory
        {
            Id = Guid.NewGuid(),
            Name = "Museum",
            NormalizedName = "MUSEUM",
            Type = ActivityType.Indoor,
            DefaultDurationHours = 2.0m,
            PlaceTags = ["tourism=museum"],
            Version = 7
        };

        var response = mapper.Map<ActivityCategoryResponse>(category);

        Assert.Equal("Indoor", response.Type);
        Assert.False(response.RequiresDaylight);
        Assert.Null(response.MaxWindMs);
        Assert.Null(response.MaxRainMmPerHour);
        Assert.Null(response.MinTemperatureC);
        Assert.Null(response.MaxTemperatureC);
        Assert.Equal(["tourism=museum"], response.PlaceTags);
        Assert.Equal(7u, response.Version);
    }

    public void Dispose() => provider.Dispose();
}
