using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>GET /api/plans/{id}/check</c> when the weather service fails or the request limit is reached (feature 012
/// spec User Story 4, FR-013, FR-015, FR-016; contracts/plan-check-api.md). Logging a weather failure belongs to
/// the real client and is covered by <c>OpenMeteoForecastClientTests</c>; the check adds no logging of its own.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public sealed class PlanCheckFailureTests : IDisposable
{
    private static readonly CheckedPlanActivity Kayaking =
        SavedPlanSeed.Outdoor("Kayaking", Guid.Parse("12000000-0000-4000-8000-000000000021"), maxWind: 8);

    private readonly PostgreSqlApiFactory factory;
    private readonly SavedPlanSeed seed;
    private readonly DateTimeOffset clockBefore;

    public PlanCheckFailureTests(PostgreSqlApiFactory factory)
    {
        this.factory = factory;
        seed = new SavedPlanSeed(factory);
        clockBefore = factory.Clock.UtcNow;
        factory.Clock.UtcNow = ScheduleScenario.Now;
    }

    public void Dispose() => factory.Clock.UtcNow = clockBefore;

    [Theory]
    [InlineData(FailureKind.Timeout)]
    [InlineData(FailureKind.Network)]
    [InlineData(FailureKind.UnexpectedStatus)]
    [InlineData(FailureKind.InvalidResponse)]
    public async Task WeatherFailure_Returns503ForTheForecast(FailureKind kind)
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await InsertKayakingAsync(user.Id, location);
        factory.Forecast.ScriptFailure(location.Latitude, location.Longitude, kind);

        var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("forecast", body.GetProperty("service").GetString());
        Assert.Equal("The weather service is unavailable. No forecast is shown.", body.GetProperty("detail").GetString());
        Assert.False(body.TryGetProperty("entries", out _));
    }

    [Fact]
    public async Task AfterRecovery_TheCheckSucceeds()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await InsertKayakingAsync(user.Id, location);
        factory.Forecast.ScriptFailure(location.Latitude, location.Longitude, FailureKind.Timeout);
        var (failed, _) = await SavedPlanSeed.CheckAsync(client, id);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed);

        factory.Forecast.ScriptRecovery(location.Latitude, location.Longitude);
        factory.Forecast.Script(location.Latitude, location.Longitude, SavedPlanSeed.CalmForecast());
        var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("checked", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task OverTheLimit_Returns429AndDoesNotCallTheWeatherService()
    {
        var user = await factory.CreateUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await InsertKayakingAsync(user.Id, location);
        var forecast = new FakeForecastClient();
        forecast.Script(location.Latitude, location.Longitude, SavedPlanSeed.CalmForecast());
        var logs = new CapturingLoggerProvider();
        await using var host = CreateHost(forecast, logs, permitLimit: "2");
        using var client = await SignedInClientAsync(host, user.Email!);

        // The first check asks the weather service; the second reuses its answer from the cache.
        Assert.Equal(HttpStatusCode.OK, (await SavedPlanSeed.CheckAsync(client, id)).Status);
        Assert.Equal(HttpStatusCode.OK, (await SavedPlanSeed.CheckAsync(client, id)).Status);
        var calls = forecast.Calls;
        var entriesBefore = logs.Entries.Count;

        var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(HttpStatusCode.TooManyRequests, status);
        Assert.Equal("Too many requests.", body.GetProperty("title").GetString());
        Assert.Equal("Too many requests. Wait a minute and try again.", body.GetProperty("detail").GetString());
        Assert.Equal(calls, forecast.Calls);
        Assert.True(forecast.Calls <= 2);
        Assert.DoesNotContain(
            logs.Entries.Skip(entriesBefore),
            entry => entry.Contains(" Warning:") || entry.Contains(" Error:") || entry.Contains(" Critical:"));
    }

    private Task<Guid> InsertKayakingAsync(string ownerId, PlaceLocation location) =>
        seed.InsertAsync(
            ownerId,
            location,
            [SavedPlanSeed.PlanDate],
            [Kayaking],
            [SavedPlanSeed.Entry(0, Kayaking, SavedPlanSeed.PlanDate, new TimeOnly(10, 0), new TimeOnly(12, 0))]);

    // A host with a low request limit and its own weather service, as PlanSetupRateLimitTests builds; the database
    // and the clock are the collection's.
    private WebApplicationFactory<Program> CreateHost(
        FakeForecastClient forecast,
        CapturingLoggerProvider logs,
        string permitLimit) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("RateLimiting:PlanSetup:PermitLimit", permitLimit);
            builder.ConfigureLogging(logging => logging
                .AddProvider(logs)
                .AddFilter<CapturingLoggerProvider>(null, LogLevel.Trace));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IGeocodingClient>();
                services.AddSingleton<IGeocodingClient>(new FakeGeocodingClient());
                services.RemoveAll<IForecastClient>();
                services.AddSingleton<IForecastClient>(forecast);
                services.RemoveAll<IMapPlacesClient>();
                services.AddSingleton<IMapPlacesClient>(new FakeMapPlacesClient());
            });
        });

    private static async Task<HttpClient> SignedInClientAsync(WebApplicationFactory<Program> host, string email)
    {
        var client = host.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });
        using var signIn = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(email)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
        return client;
    }
}
