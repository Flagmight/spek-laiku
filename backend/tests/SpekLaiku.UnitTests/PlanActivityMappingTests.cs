using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The category and checked activity objects in contracts/plan-activities-api.md.</summary>
public sealed class PlanActivityMappingTests : IDisposable
{
    private readonly ServiceProvider provider;
    private readonly IMapper mapper;

    public PlanActivityMappingTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(PlanActivityMappingProfile).Assembly);
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
            PlaceTags = ["leisure=slipway"],
            Version = 1042
        };

        var response = mapper.Map<PlanCategoryResponse>(category);

        Assert.Equal(
            new PlanCategoryResponse(id, "Kayaking", "Outdoor", 2.0m, true, 8.0m, 0.5m, 15.0m, 35.0m),
            response);
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
            DefaultDurationHours = 2.0m
        };

        var response = mapper.Map<PlanCategoryResponse>(category);

        Assert.Equal("Indoor", response.Type);
        Assert.Null(response.MaxWindMs);
        Assert.Null(response.MaxRainMmPerHour);
        Assert.Null(response.MinTemperatureC);
        Assert.Null(response.MaxTemperatureC);
    }

    [Fact]
    public void CheckedActivity_MapsEveryField()
    {
        var id = Guid.NewGuid();
        var activity = new CheckedPlanActivity(id, "Kayaking", ActivityType.Outdoor, 2.5m, true, 8m, 0.5m, 18m, 35m);

        var response = mapper.Map<CheckedPlanActivityResponse>(activity);

        Assert.Equal(
            new CheckedPlanActivityResponse(id, "Kayaking", "Outdoor", 2.5m, true, 8m, 0.5m, 18m, 35m),
            response);
    }

    [Theory]
    [InlineData("PlaceTags")]
    [InlineData("Version")]
    public void PlanCategoryResponse_HasNoAdministratorField(string property)
    {
        Assert.Null(typeof(PlanCategoryResponse).GetProperty(property));
    }

    public void Dispose() => provider.Dispose();
}
