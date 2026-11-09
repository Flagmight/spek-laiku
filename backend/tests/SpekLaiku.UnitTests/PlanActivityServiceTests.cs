using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Listing the categories for planning and checking the plan's activities (research sections 1, 4, 5).</summary>
public class PlanActivityServiceTests
{
    [Fact]
    public async Task ListCategoriesAsync_ReturnsTheStoredCategoriesInNameOrder()
    {
        await using var context = CreateContext();
        context.ActivityCategories.AddRange(Outdoor("Picnic"), Indoor("Museum"), Outdoor("Cycling"));
        await context.SaveChangesAsync();

        var categories = await Service(context).ListCategoriesAsync(CancellationToken.None);

        Assert.Equal(["Cycling", "Museum", "Picnic"], categories.Select(category => category.Name));
    }

    [Fact]
    public async Task CheckAsync_CategoryUsedTwice_ReturnsThreeResultsInRequestOrderWithStoredNames()
    {
        await using var context = CreateContext();
        var cycling = Outdoor("Cycling");
        var museum = Indoor("Museum");
        context.ActivityCategories.AddRange(cycling, museum);
        await context.SaveChangesAsync();

        var result = await Service(context).CheckAsync(
            new PlanActivitiesCheckRequest(
            [
                OutdoorRequest(cycling.Id, durationHours: 1m),
                IndoorRequest(museum.Id),
                OutdoorRequest(cycling.Id, durationHours: 3m)
            ]),
            CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Equal(
            [("Cycling", 1m), ("Museum", 2m), ("Cycling", 3m)],
            result.Activities.Select(activity => (activity.Name, activity.DurationHours)));
    }

    [Fact]
    public async Task CheckAsync_UnknownCategory_GivesTheActivityMessage()
    {
        await using var context = CreateContext();

        var result = await Service(context).CheckAsync(
            new PlanActivitiesCheckRequest([OutdoorRequest(Guid.NewGuid())]),
            CancellationToken.None);

        var error = Assert.Single(result.Errors);
        Assert.Equal("activities[0]", error.Key);
        Assert.Equal(PlanActivityValidator.UnavailableMessage, error.Value);
    }

    [Fact]
    public async Task CheckAsync_NullItemInTheList_GivesTheActivityMessage()
    {
        await using var context = CreateContext();

        var result = await Service(context).CheckAsync(new PlanActivitiesCheckRequest([null!]), CancellationToken.None);

        Assert.Equal("activities[0]", Assert.Single(result.Errors).Key);
    }

    [Theory]
    [InlineData(0, PlanActivityValidator.NoActivitiesMessage)]
    [InlineData(11, PlanActivityValidator.TooManyActivitiesMessage)]
    public async Task CheckAsync_WrongCount_ReturnsOnlyTheCountMessageWithoutAQuery(int count, string message)
    {
        // A disposed context throws on any query, so this also proves that none is made.
        var context = CreateContext();
        await context.DisposeAsync();
        var activities = Enumerable.Range(0, count).Select(_ => OutdoorRequest(Guid.NewGuid())).ToList();

        var result = await Service(context).CheckAsync(new PlanActivitiesCheckRequest(activities), CancellationToken.None);

        var error = Assert.Single(result.Errors);
        Assert.Equal("activities", error.Key);
        Assert.Equal(message, error.Value);
    }

    [Fact]
    public async Task CheckAsync_ChangedValues_LeaveTheStoredCategoryUnchanged()
    {
        var databaseName = Guid.NewGuid().ToString();
        var cycling = Outdoor("Cycling");
        await using (var seed = CreateContext(databaseName))
        {
            seed.ActivityCategories.Add(cycling);
            await seed.SaveChangesAsync();
        }

        await using (var context = CreateContext(databaseName))
        {
            var result = await Service(context).CheckAsync(
                new PlanActivitiesCheckRequest([OutdoorRequest(cycling.Id, durationHours: 7m)]),
                CancellationToken.None);
            Assert.True(result.Succeeded);
            await context.SaveChangesAsync();
        }

        await using var read = CreateContext(databaseName);
        var stored = await read.ActivityCategories.SingleAsync();
        Assert.Equal(2m, stored.DefaultDurationHours);
        Assert.Equal(8m, stored.MaxWindMs);
    }

    private static PlanActivityService Service(ApplicationDbContext context) =>
        new(context, new ActivityCategoryService(context));

    private static PlanActivityRequest OutdoorRequest(Guid categoryId, decimal durationHours = 2m) =>
        new(categoryId, "Outdoor", durationHours, true, 8m, 0.5m, 15m, 35m);

    private static PlanActivityRequest IndoorRequest(Guid categoryId) =>
        new(categoryId, "Indoor", 2m, false, null, null, null, null);

    private static ActivityCategory Outdoor(string name) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        NormalizedName = name.ToUpperInvariant(),
        Type = ActivityType.Outdoor,
        DefaultDurationHours = 2m,
        RequiresDaylight = true,
        MaxWindMs = 8m,
        MaxRainMmPerHour = 0.5m,
        MinTemperatureC = 15m,
        MaxTemperatureC = 35m
    };

    private static ActivityCategory Indoor(string name) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        NormalizedName = name.ToUpperInvariant(),
        Type = ActivityType.Indoor,
        DefaultDurationHours = 2m
    };

    private static ApplicationDbContext CreateContext(string? databaseName = null) =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString())
            .Options);
}
