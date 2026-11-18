using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// A generated schedule is remembered for 30 minutes so it can be saved exactly as shown (feature 010 spec
/// FR-004, contracts/plan-schedule-api.md, research section 2).
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class GeneratedScheduleTests(PostgreSqlApiFactory factory)
{
    private readonly ScheduleScenario scenario = new(factory);

    [Fact]
    public async Task ScheduleWithAnActivity_ReturnsAnIdAndRemembersIt()
    {
        using var client = factory.CreateHttpsClient();

        var body = await scenario.GenerateAsync(client, await scenario.IndoorPlanAsync());

        var id = body.GetProperty("generatedScheduleId").GetGuid();
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var stored = await context.GeneratedSchedules.AsNoTracking().SingleAsync(schedule => schedule.Id == id);
        Assert.Equal(ScheduleScenario.Now.UtcDateTime, stored.CreatedAtUtc);
        Assert.Equal(stored.CreatedAtUtc + TimeSpan.FromMinutes(30), stored.ExpiresAtUtc);
        var scheduled = Assert.Single(stored.Snapshot.Schedule.Scheduled);
        var shown = Assert.Single(body.GetProperty("scheduled").EnumerateArray());
        Assert.Equal(shown.GetProperty("activityName").GetString(), scheduled.ActivityName);
        Assert.Equal(shown.GetProperty("place").GetProperty("name").GetString(), scheduled.Place.Name);
        Assert.Equal(ScheduleScenario.PlanDate, scheduled.Date.ToString("yyyy-MM-dd"));
    }

    [Fact]
    public async Task NothingScheduled_ReturnsNullAndRemembersNothing()
    {
        using var client = factory.CreateHttpsClient();
        var before = await CountAsync();

        var body = await scenario.GenerateAsync(client, await scenario.NothingScheduledPlanAsync());

        Assert.Equal(JsonValueKind.Null, body.GetProperty("generatedScheduleId").ValueKind);
        Assert.Empty(body.GetProperty("scheduled").EnumerateArray());
        Assert.Equal(before, await CountAsync());
    }

    [Fact]
    public async Task GeneratingAgain_ReturnsANewId()
    {
        using var client = factory.CreateHttpsClient();
        var plan = await scenario.IndoorPlanAsync();

        var first = (await scenario.GenerateAsync(client, plan)).GetProperty("generatedScheduleId").GetGuid();
        var second = (await scenario.GenerateAsync(client, plan)).GetProperty("generatedScheduleId").GetGuid();

        Assert.NotEqual(first, second);
    }

    [Fact]
    public async Task ExpiredSchedules_AreDeletedWhenTheNextIsGenerated()
    {
        using var client = factory.CreateHttpsClient();
        var expired = await scenario.GenerateIdAsync(client);
        var plan = await scenario.IndoorPlanAsync();

        try
        {
            // Generate 31 minutes later; the plan date is still within the forecast period.
            factory.Clock.UtcNow = ScheduleScenario.Now.AddMinutes(31);
            using var response = await client.PostAsJsonAsync("/api/plan-schedule", plan);
            response.EnsureSuccessStatusCode();
        }
        finally
        {
            factory.Clock.UtcNow = ScheduleScenario.Now;
        }

        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.False(await context.GeneratedSchedules.AnyAsync(schedule => schedule.Id == expired));
    }

    [Fact]
    public async Task Find_ReturnsTheSnapshotOnlyBeforeItExpires()
    {
        using var client = factory.CreateHttpsClient();
        var id = await scenario.GenerateIdAsync(client);
        using var scope = factory.Services.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<GeneratedScheduleService>();

        try
        {
            factory.Clock.UtcNow = ScheduleScenario.Now.AddMinutes(30).AddTicks(-1);
            Assert.NotNull(await service.FindAsync(id, CancellationToken.None));

            factory.Clock.UtcNow = ScheduleScenario.Now.AddMinutes(30);
            Assert.Null(await service.FindAsync(id, CancellationToken.None));
        }
        finally
        {
            factory.Clock.UtcNow = ScheduleScenario.Now;
        }

        Assert.Null(await service.FindAsync(Guid.NewGuid(), CancellationToken.None));
    }

    private async Task<int> CountAsync()
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await context.GeneratedSchedules.CountAsync();
    }
}
