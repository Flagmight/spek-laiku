using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using SpekLaiku.Api;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// The <c>MapData</c> settings (feature 017 spec User Story 2, FR-001 to FR-004, SC-004, SC-005): the place requests
/// go to the configured main server, the public server is used without a setting, and a wrong setting stops the API
/// at start-up with a message that names the setting and not its value. No test host runs in the Development
/// environment, which would read the developer's own settings files (analysis R1); "http in Development" is covered
/// by <c>MapDataOptionsValidatorTests</c>.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class MapDataConfigurationTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-places";
    private const string Now = "2026-11-10T12:20:00Z";

    [Fact]
    public async Task DefaultSettings_UseThePublicServer()
    {
        var place = ScriptPlace();
        var categoryId = await AddCategoryAsync();
        using var client = factory.CreateHttpsClient();

        var status = await PostAsync(client, place.Id, categoryId);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(new Uri("https://overpass-api.de/"), factory.MapPlaces.LastServer!.Address);
        Assert.Equal(MapDataServerRole.Main, factory.MapPlaces.LastServer.Role);
    }

    [Fact]
    public async Task ConfiguredMainServer_IsUsedForPlaceRequests()
    {
        var place = ScriptPlace();
        var categoryId = await AddCategoryAsync();
        await using var host = WithSetting("MapData:MainServer", "https://overpass.example.test");
        using var client = CreateHttpsClient(host);

        var status = await PostAsync(client, place.Id, categoryId);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(new Uri("https://overpass.example.test/"), factory.MapPlaces.LastServer!.Address);
    }

    [Theory]
    [InlineData("MapData:MainServer", "not an address", "MapData:MainServer")]
    [InlineData("MapData:FallbackServer", "https://overpass-api.de", "MapData:FallbackServer")]
    [InlineData("MapData:MainTimeoutSeconds", "12", "MapData:MainTimeoutSeconds")]
    [InlineData("MapData:MainServer", "http://localhost:12345/", "MapData:MainServer")]
    public async Task WrongSetting_StopsTheApiAtStartUpAndNamesIt(string setting, string value, string named)
    {
        await using var host = WithSetting(setting, value);

        var exception = Record.Exception(() => host.CreateClient());

        Assert.NotNull(exception);
        var messages = AllMessages(exception);
        Assert.Contains(named, messages);
        if (value.Length > 2)
        {
            Assert.DoesNotContain(value, messages);
        }
    }

    private WebApplicationFactory<Program> WithSetting(string setting, string value) =>
        factory.WithWebHostBuilder(builder => builder.UseSetting(setting, value));

    private static HttpClient CreateHttpsClient(WebApplicationFactory<Program> host) =>
        host.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    private static string AllMessages(Exception exception)
    {
        var messages = new List<string>();
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            messages.Add(current.Message);
            if (current is AggregateException aggregate)
            {
                messages.AddRange(aggregate.InnerExceptions.Select(AllMessages));
            }
        }

        return string.Join(Environment.NewLine, messages);
    }

    private async Task<HttpStatusCode> PostAsync(HttpClient client, long locationId, Guid categoryId)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(Now, CultureInfo.InvariantCulture);
        using var response = await client.PostAsJsonAsync(Path, new
        {
            setup = new { locationId, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
            activities = new[]
            {
                new
                {
                    categoryId,
                    type = "Outdoor",
                    durationHours = 2,
                    requiresDaylight = true,
                    maxWindMs = 8,
                    maxRainMmPerHour = 0.5,
                    minTemperatureC = 15,
                    maxTemperatureC = 35
                }
            }
        });
        return response.StatusCode;
    }

    // Each test has its own location, so no places are reused from another test (shared notes in tasks.md).
    private GeocodingPlace ScriptPlace()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 55.5 + (id % 100_000 / 1_000_000.0), 22.5, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        factory.MapPlaces.Script(place.Latitude, place.Longitude, []);
        return place;
    }

    private async Task<Guid> AddCategoryAsync()
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName("Map data settings"),
            type = "Outdoor",
            defaultDurationHours = 2,
            requiresDaylight = true,
            maxWindMs = 8,
            maxRainMmPerHour = 0.5,
            minTemperatureC = 15,
            maxTemperatureC = 35,
            placeTags = "tourism=museum"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>();
        return created!.Id;
    }
}
