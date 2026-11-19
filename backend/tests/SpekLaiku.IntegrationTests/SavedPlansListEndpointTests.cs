using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>GET /api/plans</c> (feature 010 contracts/plans-api.md, spec FR-009, FR-012, SC-005): the caller's plans
/// only, newest saved first (then newest created, feature 011), as summaries without the stored schedule.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class SavedPlansListEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plans";

    private readonly ScheduleScenario scenario = new(factory);

    [Fact]
    public async Task NewUser_GetsAnEmptyList()
    {
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await client.GetAsync(Path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await ReadAsync(response)).EnumerateArray());
    }

    [Fact]
    public async Task Plans_AreListedNewestFirstWithTheSummaryKeys()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var first = await SaveAsync(client, "First", ScheduleScenario.Now);
        var second = await SaveAsync(client, "Second", ScheduleScenario.Now.AddMinutes(1));
        var third = await SaveAsync(client, "Third", ScheduleScenario.Now.AddMinutes(2));

        using var response = await client.GetAsync(Path);

        var plans = (await ReadAsync(response)).EnumerateArray().ToList();
        Assert.Equal([third, second, first], plans.Select(plan => plan.GetProperty("id").GetGuid()));
        Assert.All(plans, plan => Assert.Equal(
            ["id", "name", "locationName", "dates", "savedAt"],
            plan.EnumerateObject().Select(property => property.Name)));
        Assert.Equal("Third", plans[0].GetProperty("name").GetString());
        Assert.Equal("2026-11-10T12:22:00+00:00", plans[0].GetProperty("savedAt").GetString());
    }

    [Fact]
    public async Task PlansSavedAtTheSameTime_AreListedNewestCreatedFirst()
    {
        // Feature 011 research section 5: a copy keeps its original's saved time and is listed directly above it.
        var account = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        await SignInAsync(client, account);
        var older = await SaveAsync(client, "Created first", ScheduleScenario.Now);
        var newer = await SaveAsync(client, "Created second", ScheduleScenario.Now.AddMinutes(1));
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var plans = await context.SavedPlans.Where(plan => plan.OwnerId == account.Id).ToListAsync();
            var savedAt = ScheduleScenario.Now.UtcDateTime;
            foreach (var plan in plans)
            {
                plan.SavedAtUtc = savedAt;
                plan.CreatedAtUtc = plan.Id == newer ? savedAt.AddMinutes(5) : savedAt;
            }

            await context.SaveChangesAsync();
        }

        using var response = await client.GetAsync(Path);

        var ids = (await ReadAsync(response)).EnumerateArray().Select(plan => plan.GetProperty("id").GetGuid());
        Assert.Equal([newer, older], ids);
    }

    [Fact]
    public async Task AnotherUsersPlan_IsNotListed()
    {
        using var owner = await factory.CreateSignedInClientAsync();
        var ownersPlan = await SaveAsync(owner, "Owner's plan", ScheduleScenario.Now);
        using var other = await factory.CreateSignedInClientAsync();
        var othersPlan = await SaveAsync(other, "Other's plan", ScheduleScenario.Now);

        using var response = await other.GetAsync(Path);

        var ids = (await ReadAsync(response)).EnumerateArray().Select(plan => plan.GetProperty("id").GetGuid()).ToList();
        Assert.Equal([othersPlan], ids);
        Assert.DoesNotContain(ownersPlan, ids);
    }

    [Fact]
    public async Task FiftyPlans_AreAllListedWithoutTheirSchedules()
    {
        // Spec SC-005: the list never loads the stored schedules. The 2-second target is checked by hand
        // (quickstart Scenario 4), so this test stays deterministic.
        var account = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        await SignInAsync(client, account);
        await SaveAsync(client, "Template", ScheduleScenario.Now);
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var template = await context.SavedPlans.AsNoTracking().SingleAsync(plan => plan.OwnerId == account.Id);
            context.SavedPlans.AddRange(Enumerable.Range(1, 49).Select(index => new SavedPlan
            {
                Id = Guid.NewGuid(),
                OwnerId = account.Id,
                Name = $"Copy {index}",
                SavedAtUtc = template.SavedAtUtc.AddMinutes(index),
                LocationName = template.LocationName,
                Dates = template.Dates,
                GeneratedScheduleId = null,
                Snapshot = template.Snapshot
            }));
            await context.SaveChangesAsync();
        }

        using var response = await client.GetAsync(Path);

        var plans = (await ReadAsync(response)).EnumerateArray().ToList();
        Assert.Equal(50, plans.Count);
        Assert.Equal("Copy 49", plans[0].GetProperty("name").GetString());
        Assert.All(plans, plan => Assert.Equal(5, plan.EnumerateObject().Count()));
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("scheduled", body);
        Assert.DoesNotContain("snapshot", body, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<Guid> SaveAsync(HttpClient client, string name, DateTimeOffset savedAt)
    {
        var scheduleId = await scenario.GenerateIdAsync(client);
        try
        {
            factory.Clock.UtcNow = savedAt;
            using var response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = scheduleId, name });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await ReadAsync(response)).GetProperty("id").GetGuid();
        }
        finally
        {
            factory.Clock.UtcNow = ScheduleScenario.Now;
        }
    }

    private static async Task SignInAsync(HttpClient client, ApplicationUser account)
    {
        using var response = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(account.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }
}
