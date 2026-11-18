using System.Text.Json;
using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Mapping;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Saved plans to the response objects in feature 010 contracts/plans-api.md. The whole assembly's profiles are
/// loaded, as in the API.
/// </summary>
public sealed class SavedPlanMappingTests : IDisposable
{
    private readonly ServiceProvider provider;
    private readonly IMapper mapper;

    public SavedPlanMappingTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(SavedPlanMappingProfile).Assembly);
        provider = services.BuildServiceProvider();
        mapper = provider.GetRequiredService<IMapper>();
    }

    [Fact]
    public void Configuration_IsValid()
    {
        mapper.ConfigurationProvider.AssertConfigurationIsValid();
    }

    [Fact]
    public void SavedPlan_MapsToTheSummary()
    {
        var plan = CreatePlan();

        var response = mapper.Map<SavedPlanSummaryResponse>(plan);

        Assert.Equal(plan.Id, response.Id);
        Assert.Equal("Weekend in Kaunas", response.Name);
        Assert.Equal("Kaunas", response.LocationName);
        Assert.Equal([new DateOnly(2026, 11, 21), new DateOnly(2026, 11, 22)], response.Dates);
    }

    [Fact]
    public void SavedAt_IsTheSameInstantInUtc()
    {
        var plan = CreatePlan();

        var response = mapper.Map<SavedPlanSummaryResponse>(plan);

        Assert.Equal(TimeSpan.Zero, response.SavedAt.Offset);
        Assert.Equal(new DateTimeOffset(2026, 11, 18, 12, 5, 0, TimeSpan.Zero), response.SavedAt);
    }

    [Fact]
    public void Summary_HasNoOwnerSnapshotOrScheduleId()
    {
        Assert.Equal(
            ["Id", "Name", "LocationName", "Dates", "SavedAt"],
            typeof(SavedPlanSummaryResponse).GetProperties().Select(property => property.Name));
    }

    [Fact]
    public void SavedPlan_MapsTheSetupAndScheduleFromItsSnapshot()
    {
        var plan = CreatePlan();

        var response = mapper.Map<SavedPlanResponse>(plan);

        Assert.Equal(plan.Id, response.Id);
        Assert.Equal("Weekend in Kaunas", response.Name);
        Assert.Equal(new DateTimeOffset(2026, 11, 18, 12, 5, 0, TimeSpan.Zero), response.SavedAt);
        Assert.Equal(new SavedPlanLocationResponse("Kaunas", "Kaunas City Municipality", 54.90272, 23.90961), response.Location);
        Assert.Equal(plan.Snapshot.Setup.Dates, response.Dates);
        Assert.Equal(30, response.MaxTravelDistanceKm);
        Assert.Equal(["Cycling", "Museum"], response.Scheduled.Select(activity => activity.ActivityName));
        Assert.Equal(["Kayaking", "Picnic"], response.Unscheduled.Select(activity => activity.ActivityName));
        Assert.Equal(new TravelSummaryResponse(30, 0), response.Travel);
    }

    [Fact]
    public void SavedPlan_KeepsEachTravelLegAndItsAbsence()
    {
        var response = mapper.Map<SavedPlanResponse>(CreatePlan());

        Assert.Null(response.Scheduled[0].Travel);
        Assert.Equal(new TravelLegResponse("Nemunas cycle path", 1.1m, false), response.Scheduled[1].Travel);
        Assert.True(response.Scheduled[1].Weather.IsIndoor);
        Assert.Equal("10:00", response.Scheduled[0].StartTime);
    }

    [Fact]
    public void SavedPlan_SendsNoOwnerActivityLimitsOrInternalKeys()
    {
        var json = JsonSerializer.Serialize(mapper.Map<SavedPlanResponse>(CreatePlan()), JsonSerializerOptions.Web);

        foreach (var hidden in new[] { "categoryId", "\"key\"", "ownerId", "activities", "durationHours", "maxWindMs", "generatedScheduleId" })
        {
            Assert.DoesNotContain(hidden, json);
        }
    }

    public void Dispose() => provider.Dispose();

    private static SavedPlan CreatePlan() => new()
    {
        Id = Guid.NewGuid(),
        OwnerId = "owner-1",
        Name = "Weekend in Kaunas",
        SavedAtUtc = new DateTime(2026, 11, 18, 12, 5, 0, DateTimeKind.Unspecified),
        LocationName = "Kaunas",
        Dates = [new DateOnly(2026, 11, 21), new DateOnly(2026, 11, 22)],
        GeneratedScheduleId = Guid.NewGuid(),
        Snapshot = PlanSnapshotJsonTests.CreateSnapshot()
    };
}
