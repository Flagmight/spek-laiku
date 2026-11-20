using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// A plan check never changes the saved plan (feature 012 spec FR-014, SC-006): after any number of checks the
/// stored schedule, weather, name, saved and created times and the plan's place on My plans are identical.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public sealed class PlanCheckUnchangedTests : IDisposable
{
    private static readonly CheckedPlanActivity Kayaking =
        SavedPlanSeed.Outdoor("Kayaking", Guid.Parse("12000000-0000-4000-8000-000000000011"), maxWind: 8);

    private readonly PostgreSqlApiFactory factory;
    private readonly SavedPlanSeed seed;
    private readonly DateTimeOffset clockBefore;

    public PlanCheckUnchangedTests(PostgreSqlApiFactory factory)
    {
        this.factory = factory;
        seed = new SavedPlanSeed(factory);
        clockBefore = factory.Clock.UtcNow;
        factory.Clock.UtcNow = ScheduleScenario.Now;
    }

    public void Dispose() => factory.Clock.UtcNow = clockBefore;

    [Fact]
    public async Task ChecksWithAndWithoutProblems_LeaveThePlanUnchanged()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await InsertKayakingAsync(user.Id, location, "Checked plan");
        await InsertKayakingAsync(user.Id, SavedPlanSeed.NewLocation(), "Other plan");
        var before = await RowAsync(id);
        var listBefore = await ListIdsAsync(client);

        // A check with a problem, then (after the 30-minute forecast reuse) one without.
        factory.Forecast.Script(
            location.Latitude,
            location.Longitude,
            FakeForecastClient.WithHour(SavedPlanSeed.CalmForecast(), SavedPlanSeed.PlanDate, 11, 10.0, 0.0, 9.0));
        var (withProblem, body) = await SavedPlanSeed.CheckAsync(client, id);
        Assert.Equal(HttpStatusCode.OK, withProblem);
        Assert.NotEmpty(body.GetProperty("entries")[0].GetProperty("problems").EnumerateArray());

        factory.Clock.UtcNow = ScheduleScenario.Now.AddMinutes(31);
        factory.Forecast.Script(location.Latitude, location.Longitude, SavedPlanSeed.CalmForecast());
        var (withoutProblem, _) = await SavedPlanSeed.CheckAsync(client, id);
        Assert.Equal(HttpStatusCode.OK, withoutProblem);

        Assert.Equal(before, await RowAsync(id));
        Assert.Equal(listBefore, await ListIdsAsync(client));
    }

    private Task<Guid> InsertKayakingAsync(string ownerId, PlaceLocation location, string name) =>
        seed.InsertAsync(
            ownerId,
            location,
            [SavedPlanSeed.PlanDate],
            [Kayaking],
            [SavedPlanSeed.Entry(0, Kayaking, SavedPlanSeed.PlanDate, new TimeOnly(10, 0), new TimeOnly(12, 0))],
            name: name);

    // Everything a check could change, compared as a whole.
    private async Task<(string Snapshot, DateTime SavedAtUtc, DateTime CreatedAtUtc, string Name)> RowAsync(Guid id)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = await context.SavedPlans.AsNoTracking().SingleAsync(saved => saved.Id == id);
        return (await seed.SnapshotJsonAsync(id), plan.SavedAtUtc, plan.CreatedAtUtc, plan.Name);
    }

    private static async Task<List<Guid>> ListIdsAsync(HttpClient client)
    {
        var plans = await client.GetFromJsonAsync<List<SavedPlanSummaryResponse>>("/api/plans");
        return plans!.Select(plan => plan.Id).ToList();
    }
}
