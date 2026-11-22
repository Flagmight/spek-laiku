using System.Net;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Only the owner can check a saved plan (feature 012 spec User Story 6, FR-001; contracts/plan-check-api.md;
/// constitution III). Every refused request is answered before the weather service is contacted, so the fake
/// weather service's call count is unchanged for all but the owner.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public sealed class PlanCheckAuthorizationTests : IDisposable
{
    private const string PlanName = "Owner's checked weekend";

    private static readonly CheckedPlanActivity Kayaking =
        SavedPlanSeed.Outdoor("Kayaking", Guid.Parse("12000000-0000-4000-8000-000000000031"), maxWind: 8);

    private readonly PostgreSqlApiFactory factory;
    private readonly SavedPlanSeed seed;
    private readonly DateTimeOffset clockBefore;

    public PlanCheckAuthorizationTests(PostgreSqlApiFactory factory)
    {
        this.factory = factory;
        seed = new SavedPlanSeed(factory);
        clockBefore = factory.Clock.UtcNow;
        factory.Clock.UtcNow = ScheduleScenario.Now;
    }

    public void Dispose() => factory.Clock.UtcNow = clockBefore;

    [Fact]
    public async Task Owner_GetsTheCheck()
    {
        var (owner, _, id) = await OwnedPlanAsync();
        var calls = factory.Forecast.Calls;

        var (status, body) = await SavedPlanSeed.CheckAsync(owner, id);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("checked", body.GetProperty("status").GetString());
        Assert.Equal(calls + 1, factory.Forecast.Calls);
    }

    [Fact]
    public async Task Visitor_Gets401()
    {
        var (_, _, id) = await OwnedPlanAsync();
        using var visitor = factory.CreateHttpsClient();
        var calls = factory.Forecast.Calls;

        using var response = await visitor.GetAsync($"/api/plans/{id}/check");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync());
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task Administrator_Gets403()
    {
        var (_, location, id) = await OwnedPlanAsync();
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        var calls = factory.Forecast.Calls;

        using var response = await administrator.GetAsync($"/api/plans/{id}/check");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        AssertNoPlanData(await response.Content.ReadAsStringAsync(), location);
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task SuspendedUser_Gets403()
    {
        var (_, location, id) = await OwnedPlanAsync();
        using var suspended = await factory.CreateSignedInClientAsync(status: AccountStatus.Suspended);
        var calls = factory.Forecast.Calls;

        using var response = await suspended.GetAsync($"/api/plans/{id}/check");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        AssertNoPlanData(await response.Content.ReadAsStringAsync(), location);
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task AnotherRegisteredUser_Gets403WithNoPlanData()
    {
        var (_, location, id) = await OwnedPlanAsync();
        using var other = await factory.CreateSignedInClientAsync();
        var calls = factory.Forecast.Calls;

        using var response = await other.GetAsync($"/api/plans/{id}/check");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        AssertNoPlanData(await response.Content.ReadAsStringAsync(), location);
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task UnknownPlan_Gets404WithTheMessage()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var calls = factory.Forecast.Calls;

        var (status, body) = await SavedPlanSeed.CheckAsync(client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NotFound, status);
        Assert.Equal("This plan no longer exists.", body.GetProperty("detail").GetString());
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task DeletedPlan_Gets404()
    {
        var (owner, _, id) = await OwnedPlanAsync();
        using var deleted = await owner.DeleteAsync($"/api/plans/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        var calls = factory.Forecast.Calls;

        var (status, body) = await SavedPlanSeed.CheckAsync(owner, id);

        Assert.Equal(HttpStatusCode.NotFound, status);
        Assert.Equal("This plan no longer exists.", body.GetProperty("detail").GetString());
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task IdThatIsNotAGuid_Gets404()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var calls = factory.Forecast.Calls;

        var (status, _) = await SavedPlanSeed.CheckAsync(client, "not-a-plan-id");

        Assert.Equal(HttpStatusCode.NotFound, status);
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    /// <summary>A plan owned by a signed-in user, at its own location with a calm forecast.</summary>
    private async Task<(HttpClient Owner, PlaceLocation Location, Guid Id)> OwnedPlanAsync()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await seed.InsertAsync(
            user.Id,
            location,
            [SavedPlanSeed.PlanDate],
            [Kayaking],
            [SavedPlanSeed.Entry(0, Kayaking, SavedPlanSeed.PlanDate, new TimeOnly(10, 0), new TimeOnly(12, 0))],
            name: PlanName);
        factory.Forecast.Script(location.Latitude, location.Longitude, SavedPlanSeed.CalmForecast());
        return (client, location, id);
    }

    // A refused answer names neither the plan, its location nor any of its activities.
    private static void AssertNoPlanData(string body, PlaceLocation location)
    {
        Assert.DoesNotContain(PlanName, body);
        Assert.DoesNotContain(location.Name, body);
        Assert.DoesNotContain(Kayaking.Name, body);
        Assert.DoesNotContain("entries", body);
    }
}
