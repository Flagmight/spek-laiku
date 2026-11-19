using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plans/{id}/copies</c> (feature 011 contracts/plans-api.md, spec FR-004 to FR-006, FR-016, FR-017,
/// clarification Q3): a separate copy of the owner's plan, named "Copy of …", with the original's saved time,
/// listed directly above the original. Authorization is in <c>PlanManagementAuthorizationTests</c>.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class DuplicatePlanEndpointTests(PostgreSqlApiFactory factory)
{
    private readonly ScheduleScenario scenario = new(factory);

    [Fact]
    public async Task Duplicating_CreatesACopyWithTheContractBody()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var original = await SaveAsync(client, "Weekend in Kaunas", ScheduleScenario.Now);

        using var response = await DuplicateAsync(client, original);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var copy = await ReadAsync(response);
        var copyId = copy.GetProperty("id").GetGuid();
        Assert.NotEqual(original, copyId);
        Assert.Equal($"/api/plans/{copyId}", response.Headers.Location?.AbsolutePath);
        Assert.Equal(
            ["id", "name", "locationName", "dates", "savedAt"],
            copy.EnumerateObject().Select(property => property.Name));
        Assert.Equal("Copy of Weekend in Kaunas", copy.GetProperty("name").GetString());
        Assert.Equal("2026-11-10T12:20:00+00:00", copy.GetProperty("savedAt").GetString());
    }

    [Fact]
    public async Task TheCopy_HasTheOriginalsContentExceptItsIdAndName()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var original = await SaveAsync(client, "Weekend", ScheduleScenario.Now);
        using var duplicated = await DuplicateAsync(client, original);
        var copyId = (await ReadAsync(duplicated)).GetProperty("id").GetGuid();

        var originalBody = await GetPlanAsync(client, original);
        var copyBody = await GetPlanAsync(client, copyId);

        Assert.Equal("Copy of Weekend", copyBody.GetProperty("name").GetString());
        foreach (var property in originalBody.EnumerateObject().Where(property => property.Name is not ("id" or "name")))
        {
            Assert.Equal(property.Value.GetRawText(), copyBody.GetProperty(property.Name).GetRawText());
        }
    }

    [Fact]
    public async Task TheCopy_IsListedDirectlyAboveItsOriginal()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var oldest = await SaveAsync(client, "Oldest", ScheduleScenario.Now);
        var middle = await SaveAsync(client, "Middle", ScheduleScenario.Now.AddMinutes(1));
        var newest = await SaveAsync(client, "Newest", ScheduleScenario.Now.AddMinutes(2));

        var copy = await DuplicateAtAsync(client, middle, ScheduleScenario.Now.AddMinutes(3));

        Assert.Equal([newest, copy, middle, oldest], await ListAsync(client));
        Assert.Equal([newest, copy, middle, oldest], await ListAsync(client));
    }

    [Fact]
    public async Task ACopyOfACopy_IsListedAboveBoth()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var original = await SaveAsync(client, "A", ScheduleScenario.Now);
        var copy = await DuplicateAtAsync(client, original, ScheduleScenario.Now.AddMinutes(1));

        var copyOfCopy = await DuplicateAtAsync(client, copy, ScheduleScenario.Now.AddMinutes(2));

        Assert.Equal([copyOfCopy, copy, original], await ListAsync(client));
        Assert.Equal("Copy of Copy of A", (await GetPlanAsync(client, copyOfCopy)).GetProperty("name").GetString());
    }

    [Fact]
    public async Task ALongName_GivesACopyNameOf80Characters()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var original = await SaveAsync(client, new string('a', 80), ScheduleScenario.Now);

        using var response = await DuplicateAsync(client, original);

        var name = (await ReadAsync(response)).GetProperty("name").GetString()!;
        Assert.Equal(80, name.Length);
        Assert.Equal("Copy of " + new string('a', 72), name);
    }

    [Fact]
    public async Task TheCopy_IsNotLinkedToAGeneratedSchedule()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var original = await SaveAsync(client, "Weekend", ScheduleScenario.Now);

        using var response = await DuplicateAsync(client, original);

        var copyId = (await ReadAsync(response)).GetProperty("id").GetGuid();
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var stored = await context.SavedPlans.AsNoTracking().SingleAsync(plan => plan.Id == copyId);
        Assert.Null(stored.GeneratedScheduleId);
    }

    [Fact]
    public async Task DeletingTheCopy_LeavesTheOriginalUnchanged()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var original = await SaveAsync(client, "Weekend", ScheduleScenario.Now);
        var before = await GetPlanAsync(client, original);
        using var duplicated = await DuplicateAsync(client, original);
        var copyId = (await ReadAsync(duplicated)).GetProperty("id").GetGuid();

        using var deleted = await client.DeleteAsync($"/api/plans/{copyId}");

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(before.GetRawText(), (await GetPlanAsync(client, original)).GetRawText());
    }

    [Fact]
    public async Task AnOwnerInTheBody_IsIgnored()
    {
        var other = await factory.CreateUserAsync();
        using var client = await factory.CreateSignedInClientAsync();
        var original = await SaveAsync(client, "Weekend", ScheduleScenario.Now);

        using var response = await client.PostAsJsonAsync($"/api/plans/{original}/copies", new { ownerId = other.Id });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var copyId = (await ReadAsync(response)).GetProperty("id").GetGuid();
        Assert.Contains(copyId, await ListAsync(client));
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.False(await context.SavedPlans.AnyAsync(plan => plan.OwnerId == other.Id));
    }

    [Fact]
    public async Task Duplicating_CallsNeitherExternalService()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var original = await SaveAsync(client, "Weekend", ScheduleScenario.Now);
        var forecastCalls = factory.Forecast.Calls;
        var mapCalls = factory.MapPlaces.Calls;

        using var response = await DuplicateAsync(client, original);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(forecastCalls, factory.Forecast.Calls);
        Assert.Equal(mapCalls, factory.MapPlaces.Calls);
    }

    private static Task<HttpResponseMessage> DuplicateAsync(HttpClient client, Guid id) =>
        client.PostAsync($"/api/plans/{id}/copies", content: null);

    private async Task<Guid> DuplicateAtAsync(HttpClient client, Guid id, DateTimeOffset at)
    {
        try
        {
            factory.Clock.UtcNow = at;
            using var response = await DuplicateAsync(client, id);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await ReadAsync(response)).GetProperty("id").GetGuid();
        }
        finally
        {
            factory.Clock.UtcNow = ScheduleScenario.Now;
        }
    }

    private async Task<Guid> SaveAsync(HttpClient client, string name, DateTimeOffset savedAt)
    {
        var scheduleId = await scenario.GenerateIdAsync(client);
        try
        {
            factory.Clock.UtcNow = savedAt;
            using var response = await client.PostAsJsonAsync("/api/plans", new { generatedScheduleId = scheduleId, name });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await ReadAsync(response)).GetProperty("id").GetGuid();
        }
        finally
        {
            factory.Clock.UtcNow = ScheduleScenario.Now;
        }
    }

    private static async Task<List<Guid>> ListAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/plans");
        return [.. (await ReadAsync(response)).EnumerateArray().Select(plan => plan.GetProperty("id").GetGuid())];
    }

    private static async Task<JsonElement> GetPlanAsync(HttpClient client, Guid id)
    {
        using var response = await client.GetAsync($"/api/plans/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync(response);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }
}
