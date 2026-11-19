using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>GET /api/plans/{id}</c> by the plan's owner (feature 010 contracts/plans-api.md, spec FR-010, FR-015,
/// FR-016, SC-003): the plan exactly as saved, without recalculating or calling the external services.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class SavedPlanDetailsEndpointTests(PostgreSqlApiFactory factory)
{
    private readonly ScheduleScenario scenario = new(factory);

    [Fact]
    public async Task OwnersPlan_IsReturnedExactlyAsGenerated()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var generated = await scenario.GenerateAsync(client, await scenario.IndoorPlanAsync());
        var id = await SaveAsync(client, generated.GetProperty("generatedScheduleId").GetGuid(), "Weekend in Kaunas");

        using var response = await client.GetAsync($"/api/plans/{id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var plan = await ReadAsync(response);
        // Feature 011 contracts/plans-api.md: the location id and the activities are added for editing.
        Assert.Equal(
            [
                "id", "name", "savedAt", "location", "dates", "maxTravelDistanceKm", "activities", "scheduled",
                "unscheduled", "travel"
            ],
            plan.EnumerateObject().Select(property => property.Name));
        Assert.Equal("Weekend in Kaunas", plan.GetProperty("name").GetString());
        Assert.Equal(
            ["id", "name", "area", "latitude", "longitude"],
            plan.GetProperty("location").EnumerateObject().Select(property => property.Name));
        var activity = Assert.Single(plan.GetProperty("activities").EnumerateArray());
        Assert.Equal(
            [
                "categoryId", "name", "type", "durationHours", "requiresDaylight", "maxWindMs", "maxRainMmPerHour",
                "minTemperatureC", "maxTemperatureC"
            ],
            activity.EnumerateObject().Select(property => property.Name));
        Assert.Equal("Indoor", activity.GetProperty("type").GetString());
        Assert.Equal("Testinė", plan.GetProperty("location").GetProperty("name").GetString());
        Assert.Equal(30, plan.GetProperty("maxTravelDistanceKm").GetInt32());
        foreach (var part in new[] { "scheduled", "unscheduled", "travel" })
        {
            Assert.Equal(generated.GetProperty(part).GetRawText(), plan.GetProperty(part).GetRawText());
        }
    }

    [Fact]
    public async Task OpeningAPlan_CallsNeitherExternalService()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, await scenario.GenerateIdAsync(client), "Weekend");
        var forecastCalls = factory.Forecast.Calls;
        var mapCalls = factory.MapPlaces.Calls;

        using var response = await client.GetAsync($"/api/plans/{id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(forecastCalls, factory.Forecast.Calls);
        Assert.Equal(mapCalls, factory.MapPlaces.Calls);
    }

    [Fact]
    public async Task RenamedCategory_DoesNotChangeTheSavedPlan()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, await scenario.GenerateIdAsync(client), "Weekend");
        string savedName;
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var saved = await context.SavedPlans.AsNoTracking().SingleAsync(plan => plan.Id == id);
            var activity = saved.Snapshot.Activities.Single();
            savedName = activity.Name;
            var newName = PostgreSqlApiFactory.UniqueCategoryName("Renamed");
            await context.ActivityCategories
                .Where(category => category.Id == activity.CategoryId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(category => category.Name, newName)
                    .SetProperty(category => category.NormalizedName, newName.ToUpperInvariant()));
        }

        using var response = await client.GetAsync($"/api/plans/{id}");

        var scheduled = (await ReadAsync(response)).GetProperty("scheduled").EnumerateArray().Single();
        Assert.Equal(savedName, scheduled.GetProperty("activityName").GetString());
    }

    [Fact]
    public async Task UnknownPlan_Returns404WithTheMessage()
    {
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await client.GetAsync($"/api/plans/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("This plan no longer exists.", (await ReadAsync(response)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task AddressThatIsNotAPlanId_Returns404()
    {
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await client.GetAsync("/api/plans/not-a-guid");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task<Guid> SaveAsync(HttpClient client, Guid scheduleId, string name)
    {
        using var response = await client.PostAsJsonAsync("/api/plans", new { generatedScheduleId = scheduleId, name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadAsync(response)).GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }
}
