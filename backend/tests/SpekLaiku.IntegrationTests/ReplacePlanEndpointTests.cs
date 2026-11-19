using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>PUT /api/plans/{id}</c>, saving changes from an edit (feature 011 contracts/plans-api.md, spec FR-010,
/// FR-011, research section 3): the owner's plan is replaced in place by a schedule the server generated, and is
/// unchanged after any refusal. Each generated schedule has its own place and category, so a second one is a
/// different plan. Authorization is in <c>PlanManagementAuthorizationTests</c>.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class ReplacePlanEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Expired = "Generate the schedule again to save it.";

    private readonly ScheduleScenario scenario = new(factory);

    [Fact]
    public async Task SavingChanges_ReplacesThePlanInPlace()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend in Kaunas");
        var before = await StoredAsync(id);
        var generated = await scenario.GenerateAsync(client, await scenario.IndoorPlanAsync());
        var scheduleId = generated.GetProperty("generatedScheduleId").GetGuid();
        var savedAt = ScheduleScenario.Now.AddMinutes(5);

        using var response = await ReplaceAtAsync(client, id, new { generatedScheduleId = scheduleId, name = "Kaunas trip" }, savedAt);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await ReadAsync(response);
        Assert.Equal(id, summary.GetProperty("id").GetGuid());
        Assert.Equal("Kaunas trip", summary.GetProperty("name").GetString());
        Assert.Equal("2026-11-10T12:25:00+00:00", summary.GetProperty("savedAt").GetString());
        var plan = await GetPlanAsync(client, id);
        foreach (var part in new[] { "scheduled", "unscheduled", "travel" })
        {
            Assert.Equal(generated.GetProperty(part).GetRawText(), plan.GetProperty(part).GetRawText());
        }

        var after = await StoredAsync(id);
        Assert.NotEqual(before.Snapshot, after.Snapshot);
        Assert.Equal(scheduleId, after.GeneratedScheduleId);
        Assert.Equal(before.CreatedAtUtc, after.CreatedAtUtc);
        Assert.Equal([id], await ListAsync(client));
    }

    [Fact]
    public async Task ARepeatWithTheSameSchedule_OnlyAppliesTheName()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        var scheduleId = await scenario.GenerateIdAsync(client);
        using var first = await ReplaceAtAsync(client, id, new { generatedScheduleId = scheduleId, name = "First" }, ScheduleScenario.Now);
        var afterFirst = await StoredAsync(id);

        using var second = await ReplaceAtAsync(
            client, id, new { generatedScheduleId = scheduleId, name = "Second" }, ScheduleScenario.Now.AddMinutes(1));

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var afterSecond = await StoredAsync(id);
        Assert.Equal("Second", afterSecond.Name);
        Assert.Equal(afterFirst with { Name = "Second" }, afterSecond);
    }

    [Fact]
    public async Task AScheduleSavedInAnotherPlan_IsRefusedAndThePlanIsUnchanged()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        var otherScheduleId = await scenario.GenerateIdAsync(client);
        await SaveAsync(client, otherScheduleId, "Other plan");
        var before = await StoredAsync(id);

        using var response = await ReplaceAtAsync(
            client, id, new { generatedScheduleId = otherScheduleId, name = "Weekend" }, ScheduleScenario.Now);

        await AssertErrorsAsync(response, ("generatedScheduleId", Expired));
        Assert.Equal(before, await StoredAsync(id));
    }

    [Fact]
    public async Task UnknownMissingAndExpiredSchedules_AreRefusedAndThePlanIsUnchanged()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        var expiring = await scenario.GenerateIdAsync(client);
        var before = await StoredAsync(id);

        foreach (var scheduleId in new Guid?[] { Guid.NewGuid(), null })
        {
            using var response = await ReplaceAtAsync(
                client, id, new { generatedScheduleId = scheduleId, name = "Weekend" }, ScheduleScenario.Now);
            await AssertErrorsAsync(response, ("generatedScheduleId", Expired));
        }

        using (var expired = await ReplaceAtAsync(
            client, id, new { generatedScheduleId = expiring, name = "Weekend" }, ScheduleScenario.Now.AddMinutes(30)))
        {
            await AssertErrorsAsync(expired, ("generatedScheduleId", Expired));
        }

        Assert.Equal(before, await StoredAsync(id));
    }

    [Fact]
    public async Task AnEmptyNameAndAnUnknownSchedule_GiveBothErrors()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        var before = await StoredAsync(id);

        using var response = await ReplaceAtAsync(
            client, id, new { generatedScheduleId = Guid.NewGuid(), name = "  " }, ScheduleScenario.Now);

        await AssertErrorsAsync(response, ("name", "Enter a plan name."), ("generatedScheduleId", Expired));
        Assert.Equal(before, await StoredAsync(id));
    }

    [Fact]
    public async Task AScheduleWithNothingScheduled_IsRefused()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        var nothing = await scenario.GenerateAsync(client, await scenario.NothingScheduledPlanAsync());
        var before = await StoredAsync(id);

        // Generation remembers no schedule when nothing was scheduled, so its id is null and refused as expired.
        Assert.Equal(JsonValueKind.Null, nothing.GetProperty("generatedScheduleId").ValueKind);
        using var response = await ReplaceAtAsync(
            client, id, new { generatedScheduleId = (Guid?)null, name = "Weekend" }, ScheduleScenario.Now);

        await AssertErrorsAsync(response, ("generatedScheduleId", Expired));
        Assert.Equal(before, await StoredAsync(id));
    }

    [Fact]
    public async Task OtherFieldsInTheBody_AreIgnored()
    {
        var other = await factory.CreateUserAsync();
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        var generated = await scenario.GenerateAsync(client, await scenario.IndoorPlanAsync());

        using var response = await ReplaceAtAsync(client, id, new
        {
            generatedScheduleId = generated.GetProperty("generatedScheduleId").GetGuid(),
            name = "Weekend",
            ownerId = other.Id,
            setup = new { locationId = 1, dates = new[] { "2030-01-01" }, maxTravelDistanceKm = 5 },
            scheduled = Array.Empty<object>()
        }, ScheduleScenario.Now);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var plan = await GetPlanAsync(client, id);
        Assert.Equal(generated.GetProperty("scheduled").GetRawText(), plan.GetProperty("scheduled").GetRawText());
        Assert.Equal(30, plan.GetProperty("maxTravelDistanceKm").GetInt32());
        Assert.Equal([id], await ListAsync(client));
    }

    private async Task<HttpResponseMessage> ReplaceAtAsync(HttpClient client, Guid id, object body, DateTimeOffset at)
    {
        try
        {
            factory.Clock.UtcNow = at;
            return await client.PutAsJsonAsync($"/api/plans/{id}", body);
        }
        finally
        {
            factory.Clock.UtcNow = ScheduleScenario.Now;
        }
    }

    private async Task<Guid> SaveAsync(HttpClient client, string name) =>
        await SaveAsync(client, await scenario.GenerateIdAsync(client), name);

    private static async Task<Guid> SaveAsync(HttpClient client, Guid scheduleId, string name)
    {
        using var response = await client.PostAsJsonAsync("/api/plans", new { generatedScheduleId = scheduleId, name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadAsync(response)).GetProperty("id").GetGuid();
    }

    private sealed record Stored(
        string Name,
        DateTime SavedAtUtc,
        DateTime CreatedAtUtc,
        Guid? GeneratedScheduleId,
        string Snapshot);

    private async Task<Stored> StoredAsync(Guid id)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = await context.SavedPlans.AsNoTracking().SingleAsync(saved => saved.Id == id);
        return new Stored(
            plan.Name,
            plan.SavedAtUtc,
            plan.CreatedAtUtc,
            plan.GeneratedScheduleId,
            JsonSerializer.Serialize(plan.Snapshot));
    }

    private static async Task AssertErrorsAsync(
        HttpResponseMessage response,
        params (string Key, string Message)[] expected)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadAsync(response)).GetProperty("errors");
        Assert.Equal(expected.Select(error => error.Key).Order(), errors.EnumerateObject().Select(e => e.Name).Order());
        foreach (var (key, message) in expected)
        {
            Assert.Equal(message, errors.GetProperty(key)[0].GetString());
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
