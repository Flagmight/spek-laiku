using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>DELETE /api/plans/{id}</c> (feature 011 contracts/plans-api.md, spec FR-001, FR-017): the owner's plan is
/// deleted permanently and nothing else changes. Authorization is in <c>PlanManagementAuthorizationTests</c>.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class DeletePlanEndpointTests(PostgreSqlApiFactory factory)
{
    private readonly ScheduleScenario scenario = new(factory);

    [Fact]
    public async Task DeletingAPlan_RemovesItFromTheListAndItsAddress()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var deleted = await SaveAsync(client, "Weekend in Kaunas");
        var kept = await SaveAsync(client, "Vilnius day");

        using var response = await client.DeleteAsync($"/api/plans/{deleted}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
        using var list = await client.GetAsync("/api/plans");
        var ids = (await ReadAsync(list)).EnumerateArray().Select(plan => plan.GetProperty("id").GetGuid());
        Assert.Equal([kept], ids);
        using var opened = await client.GetAsync($"/api/plans/{deleted}");
        Assert.Equal(HttpStatusCode.NotFound, opened.StatusCode);
        Assert.Equal("This plan no longer exists.", (await ReadAsync(opened)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task DeletingAPlanTwice_GivesNotFoundTheSecondTime()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        using var first = await client.DeleteAsync($"/api/plans/{id}");

        using var second = await client.DeleteAsync($"/api/plans/{id}");

        Assert.Equal(HttpStatusCode.NotFound, second.StatusCode);
        Assert.Equal("This plan no longer exists.", (await ReadAsync(second)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task DeletingAPlan_LeavesTheUsersOtherPlansUnchanged()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var deleted = await SaveAsync(client, "Weekend");
        var kept = await SaveAsync(client, "Vilnius day");
        var before = await StoredAsync(kept);

        using var response = await client.DeleteAsync($"/api/plans/{deleted}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(before, await StoredAsync(kept));
    }

    [Fact]
    public async Task DeletingAPlan_KeepsTheGeneratedScheduleItWasSavedFrom()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var scheduleId = await scenario.GenerateIdAsync(client);
        var id = await SaveAsync(client, scheduleId, "Weekend");

        using var response = await client.DeleteAsync($"/api/plans/{id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.True(await context.GeneratedSchedules.AnyAsync(schedule => schedule.Id == scheduleId));
    }

    [Fact]
    public async Task DeletingAPlan_CallsNeitherExternalService()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        var forecastCalls = factory.Forecast.Calls;
        var mapCalls = factory.MapPlaces.Calls;

        using var response = await client.DeleteAsync($"/api/plans/{id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(forecastCalls, factory.Forecast.Calls);
        Assert.Equal(mapCalls, factory.MapPlaces.Calls);
    }

    private async Task<Guid> SaveAsync(HttpClient client, string name) =>
        await SaveAsync(client, await scenario.GenerateIdAsync(client), name);

    private static async Task<Guid> SaveAsync(HttpClient client, Guid scheduleId, string name)
    {
        using var response = await client.PostAsJsonAsync("/api/plans", new { generatedScheduleId = scheduleId, name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadAsync(response)).GetProperty("id").GetGuid();
    }

    // The stored values that must not change, with the snapshot as JSON so it compares by value.
    private async Task<(string Name, DateTime SavedAtUtc, string Snapshot)> StoredAsync(Guid id)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = await context.SavedPlans.AsNoTracking().SingleAsync(saved => saved.Id == id);
        return (plan.Name, plan.SavedAtUtc, JsonSerializer.Serialize(plan.Snapshot));
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }
}
