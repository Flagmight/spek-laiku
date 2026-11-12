using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plan-places</c> when a service fails (spec FR-009, FR-010; contracts/plan-places-api.md): the
/// <c>503</c> answer names the map data service, no category's places are shown, each failure is recorded
/// once without the plan's position or tags, and failures are not reused. Every test uses its own place id
/// and position, because places are reused per location.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanPlacesFailureTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-places";
    private const string Now = "2026-11-10T12:20:00Z";

    [Theory]
    [InlineData(FailureKind.Timeout)]
    [InlineData(FailureKind.Network)]
    [InlineData(FailureKind.UnexpectedStatus)]
    [InlineData(FailureKind.InvalidResponse)]
    public async Task MapDataServiceFailure_Answers503ForThePlaces(FailureKind kind)
    {
        var place = ScriptPlace();
        factory.MapPlaces.ScriptFailure(place.Latitude, place.Longitude, kind);

        var (status, body) = await PostAsync(place.Id, await AddCategoryAsync("leisure=slipway"));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("places", body.GetProperty("service").GetString());
        Assert.Equal("The map data service is unavailable. No places are shown.", body.GetProperty("detail").GetString());
        Assert.False(body.TryGetProperty("categories", out _));
    }

    [Fact]
    public async Task FailureForANewCategory_ShowsNoPlacesEvenForAReusedOne()
    {
        var place = ScriptPlace();
        factory.MapPlaces.Script(
            place.Latitude,
            place.Longitude,
            [FakeMapPlacesClient.Element("node/1", place.Latitude, place.Longitude, ("name", "Slipway"), ("leisure", "slipway"))]);
        var kayakingId = await AddCategoryAsync("leisure=slipway");
        var museumId = await AddCategoryAsync("tourism=museum");
        var (first, _) = await PostAsync(place.Id, kayakingId);
        Assert.Equal(HttpStatusCode.OK, first);

        factory.MapPlaces.ScriptFailure(place.Latitude, place.Longitude, FailureKind.Timeout);
        var (status, body) = await PostAsync(place.Id, kayakingId, museumId);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("places", body.GetProperty("service").GetString());
        Assert.False(body.TryGetProperty("categories", out _));
        Assert.Equal(["tourism=museum"], factory.MapPlaces.LastTags(place.Latitude, place.Longitude));
    }

    [Fact]
    public async Task FailureIsNotReused_TheNextRequestAsksAgain()
    {
        var place = ScriptPlace();
        factory.MapPlaces.ScriptFailure(place.Latitude, place.Longitude, FailureKind.Network);
        var categoryId = await AddCategoryAsync("leisure=slipway");
        var (failed, _) = await PostAsync(place.Id, categoryId);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed);

        factory.MapPlaces.ScriptRecovery(place.Latitude, place.Longitude);
        factory.MapPlaces.Script(place.Latitude, place.Longitude, []);
        var calls = factory.MapPlaces.Calls;
        var (status, _) = await PostAsync(place.Id, categoryId);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(calls + 1, factory.MapPlaces.Calls);
    }

    [Fact]
    public async Task LocationLookupFailure_Answers503ForTheLocationSearchWithoutAskingForPlaces()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        factory.Geocoding.ScriptGetFailure(id, FailureKind.Timeout);
        var categoryId = await AddCategoryAsync("leisure=slipway");
        var mapCalls = factory.MapPlaces.Calls;

        var (status, body) = await PostAsync(id, categoryId);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("locationSearch", body.GetProperty("service").GetString());
        Assert.Equal(mapCalls, factory.MapPlaces.Calls);
    }

    [Theory]
    [InlineData(HttpStatusCode.GatewayTimeout, "{}", "UnexpectedStatus")]
    [InlineData(HttpStatusCode.TooManyRequests, "{}", "UnexpectedStatus")]
    [InlineData(HttpStatusCode.OK, "not json", "InvalidResponse")]
    [InlineData(HttpStatusCode.OK, """{"remark":"runtime error: Query timed out in \"query\" at line 3 after 4 seconds.","elements":[]}""", "Timeout")]
    public async Task EachFailure_IsRecordedOnceWithItsKindAndWithoutThePlan(
        HttpStatusCode status,
        string body,
        string kind)
    {
        // The real Overpass client behind a fake network, so its own warning is what is recorded.
        var place = ScriptPlace();
        var categoryId = await AddCategoryAsync("leisure=slipway");
        var logs = new CapturingLoggerProvider();
        await using var host = WithOverpassAnswer(logs, status, body);
        using var client = host.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        factory.Clock.UtcNow = DateTimeOffset.Parse(Now, CultureInfo.InvariantCulture);
        using var response = await client.PostAsJsonAsync(Path, Request(place.Id, categoryId));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var failure = Assert.Single(logs.Entries, entry => entry.Contains("Map data service failed"));
        Assert.Contains("Warning", failure);
        Assert.Contains(kind, failure);
        AssertHasNoPlan(failure, place);

        // Nothing the API writes at its configured levels holds the plan either. The framework's own Trace and
        // Debug entries (for example MVC listing an action's arguments) are left out: appsettings.json keeps
        // Microsoft.AspNetCore at Warning, so they are never written outside a test that captures every level.
        foreach (var entry in logs.Entries.Where(entry => !entry.Contains(" Trace: ") && !entry.Contains(" Debug: ")))
        {
            AssertHasNoPlan(entry, place);
        }
    }

    private static void AssertHasNoPlan(string entry, GeocodingPlace place)
    {
        Assert.DoesNotContain(place.Latitude.ToString("F3", CultureInfo.InvariantCulture), entry);
        Assert.DoesNotContain(place.Id.ToString(CultureInfo.InvariantCulture), entry);
        Assert.DoesNotContain("slipway", entry);
    }

    private WebApplicationFactory<Program> WithOverpassAnswer(
        CapturingLoggerProvider logs,
        HttpStatusCode status,
        string body) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureLogging(logging => logging
                .AddProvider(logs)
                .AddFilter<CapturingLoggerProvider>(null, LogLevel.Trace));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IMapPlacesClient>();
                services.AddSingleton<IMapPlacesClient>(provider =>
                {
                    var httpClient = new HttpClient(new FixedAnswerHandler(status, body));
                    OverpassMapPlacesClient.Configure(httpClient);
                    return new OverpassMapPlacesClient(
                        httpClient,
                        provider.GetRequiredService<ILogger<OverpassMapPlacesClient>>());
                });
            });
        });

    private static object Request(long locationId, params Guid[] categoryIds) => new
    {
        setup = new { locationId, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
        activities = categoryIds.Select(categoryId => new
        {
            categoryId,
            type = "Outdoor",
            durationHours = 2,
            requiresDaylight = true,
            maxWindMs = 8,
            maxRainMmPerHour = 0.5,
            minTemperatureC = 15,
            maxTemperatureC = 35
        }).ToArray()
    };

    private GeocodingPlace ScriptPlace()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 55.5 + (id % 100_000 / 1_000_000.0), 22.5, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        return place;
    }

    private async Task<Guid> AddCategoryAsync(string placeTags)
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName("Places failure"),
            type = "Outdoor",
            defaultDurationHours = 2,
            requiresDaylight = true,
            maxWindMs = 8,
            maxRainMmPerHour = 0.5,
            minTemperatureC = 15,
            maxTemperatureC = 35,
            placeTags
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>();
        return created!.Id;
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(long locationId, params Guid[] categoryIds)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(Now, CultureInfo.InvariantCulture);
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, Request(locationId, categoryIds));
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (response.StatusCode, document.RootElement.Clone());
    }

    /// <summary>Answers every request with the same status and body, as a broken Overpass service would.</summary>
    private sealed class FixedAnswerHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            });
    }
}
