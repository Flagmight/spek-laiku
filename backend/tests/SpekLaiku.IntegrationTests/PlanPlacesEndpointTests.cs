using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plan-places</c> as a Visitor (contracts/plan-places-api.md), against the fake location and map
/// data services. Places are reused per location id, radius and tags, so every test scripts its own place id
/// and position, and adds its own categories.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanPlacesEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-places";

    // 14:20 on 2026-11-10 in Vilnius (UTC+2).
    private const string Now = "2026-11-10T12:20:00Z";

    // 1 km due north, on the sphere the API measures distances with.
    private const double OneKmInDegrees = 180 / (6371.0088 * Math.PI);

    [Fact]
    public async Task ValidPlan_ReturnsTheContractBody()
    {
        var place = ScriptPlace();
        var kayakingId = await AddCategoryAsync("Places kayaking", "Outdoor", "leisure=slipway,sport=canoe");
        var museumId = await AddCategoryAsync("Places museum", "Indoor", "tourism=museum");
        var picnicId = await AddCategoryAsync("Places picnic", "Outdoor", "leisure=picnic_table");
        factory.MapPlaces.Script(
            place.Latitude,
            place.Longitude,
            [
                North(place, "node/1", 3.44, ("name", "Nemuno slipway"), ("leisure", "slipway"), ("addr:city", "Kaunas")),
                North(place, "way/2", 1.2, ("name", "Kauno irklavimo bazė"), ("sport", "canoe")),
                North(place, "node/3", 0.5, ("leisure", "slipway")),
                North(place, "node/4", 5.0, ("name", "Penkta"), ("leisure", "slipway")),
                North(place, "node/5", 6.0, ("name", "Šešta"), ("leisure", "slipway")),
                North(place, "node/6", 7.0, ("name", "Septinta"), ("leisure", "slipway")),
                North(place, "node/7", 8.0, ("name", "Aštunta"), ("leisure", "slipway")),
                North(place, "node/8", 2.0, ("name", "Kauno muziejus"), ("tourism", "museum"))
            ]);

        var (status, body) = await PostAsync(new
        {
            setup = new { locationId = place.Id, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
            activities = new[] { Activity(kayakingId, "Outdoor"), Activity(museumId, "Indoor"), Activity(kayakingId, "Outdoor"), Activity(picnicId, "Outdoor") }
        });

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(["updatedAt", "radiusKm", "categories"], Keys(body));
        Assert.Equal("14:20", body.GetProperty("updatedAt").GetString());
        Assert.Equal(30, body.GetProperty("radiusKm").GetInt32());

        var categories = body.GetProperty("categories").EnumerateArray().ToList();
        // Two activities of one category give one entry, in order of first appearance.
        Assert.Equal(
            [kayakingId, museumId, picnicId],
            categories.Select(category => category.GetProperty("categoryId").GetGuid()));
        Assert.Equal(["categoryId", "places"], Keys(categories[0]));

        // Nearest first, the unnamed slipway left out, at most 5.
        var kayaking = categories[0].GetProperty("places").EnumerateArray().ToList();
        Assert.Equal(
            ["Kauno irklavimo bazė", "Nemuno slipway", "Penkta", "Šešta", "Septinta"],
            kayaking.Select(item => item.GetProperty("name").GetString()));
        var slipway = kayaking[1];
        Assert.Equal(["name", "latitude", "longitude", "distanceKm", "area"], Keys(slipway));
        Assert.Equal(3.4m, slipway.GetProperty("distanceKm").GetDecimal());
        Assert.Equal("Kaunas", slipway.GetProperty("area").GetString());
        Assert.Equal(JsonValueKind.Null, kayaking[0].GetProperty("area").ValueKind);
        Assert.Equal(Math.Round(place.Latitude + 3.44 * OneKmInDegrees, 5), slipway.GetProperty("latitude").GetDouble());
        Assert.Equal(place.Longitude, slipway.GetProperty("longitude").GetDouble());

        Assert.Equal(
            ["Kauno muziejus"],
            categories[1].GetProperty("places").EnumerateArray().Select(item => item.GetProperty("name").GetString()));
        Assert.Equal(0, categories[2].GetProperty("places").GetArrayLength());
    }

    [Fact]
    public async Task Answer_NeverContainsTagsOrMapElementIds()
    {
        var place = ScriptPlace();
        var kayakingId = await AddCategoryAsync("Places private kayaking", "Outdoor", "leisure=slipway");
        factory.MapPlaces.Script(
            place.Latitude,
            place.Longitude,
            [North(place, "node/424242", 1, ("name", "Slipway"), ("leisure", "slipway"))]);

        var raw = await PostRawAsync(Request(place.Id, 30, kayakingId));

        Assert.DoesNotContain("leisure", raw);
        Assert.DoesNotContain("slipway", raw);
        Assert.DoesNotContain("424242", raw);
        Assert.DoesNotContain("tags", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\"key\"", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(10, 10)]
    [InlineData(80, 50)]
    public async Task Radius_IsTheMaximumTravelDistanceCappedAt50Km(int maxTravelDistanceKm, int radiusKm)
    {
        var place = ScriptPlace();
        var kayakingId = await AddCategoryAsync("Places radius", "Outdoor", "leisure=slipway");
        factory.MapPlaces.Script(
            place.Latitude,
            place.Longitude,
            [
                North(place, "node/1", 9.9, ("name", "Inside 10"), ("leisure", "slipway")),
                North(place, "node/2", 12, ("name", "Inside 50"), ("leisure", "slipway")),
                North(place, "node/3", 55, ("name", "Outside 50"), ("leisure", "slipway"))
            ]);

        var (status, body) = await PostAsync(Request(place.Id, maxTravelDistanceKm, kayakingId));

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(radiusKm, body.GetProperty("radiusKm").GetInt32());
        var names = body.GetProperty("categories")[0].GetProperty("places").EnumerateArray()
            .Select(item => item.GetProperty("name").GetString())
            .ToList();
        Assert.Equal(radiusKm == 10 ? ["Inside 10"] : ["Inside 10", "Inside 50"], names);
    }

    private static List<string> Keys(JsonElement element) =>
        element.EnumerateObject().Select(property => property.Name).ToList();

    private static object Activity(Guid categoryId, string type) => type == "Outdoor"
        ? (object)new
        {
            categoryId,
            type,
            durationHours = 2,
            requiresDaylight = true,
            maxWindMs = (double?)8,
            maxRainMmPerHour = (double?)0.5,
            minTemperatureC = (double?)15,
            maxTemperatureC = (double?)35
        }
        : new
        {
            categoryId,
            type,
            durationHours = 1.5,
            requiresDaylight = false,
            maxWindMs = (double?)null,
            maxRainMmPerHour = (double?)null,
            minTemperatureC = (double?)null,
            maxTemperatureC = (double?)null
        };

    private static object Request(long locationId, int maxTravelDistanceKm, Guid categoryId) => new
    {
        setup = new { locationId, dates = new[] { "2026-11-12" }, maxTravelDistanceKm },
        activities = new[] { Activity(categoryId, "Outdoor") }
    };

    private static MapElement North(GeocodingPlace place, string key, double km, params (string Key, string Value)[] tags) =>
        FakeMapPlacesClient.Element(key, place.Latitude + km * OneKmInDegrees, place.Longitude, tags);

    /// <summary>A place in Lithuania with its own id and position, so no other test shares its cached places.</summary>
    private GeocodingPlace ScriptPlace()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 55.0 + (id % 100_000 / 1_000_000.0), 23.5, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        return place;
    }

    private async Task<Guid> AddCategoryAsync(string prefix, string type, string placeTags)
    {
        var category = type == "Outdoor"
            ? (object)new
            {
                name = PostgreSqlApiFactory.UniqueCategoryName(prefix),
                type,
                defaultDurationHours = 2,
                requiresDaylight = true,
                maxWindMs = 8,
                maxRainMmPerHour = 0.5,
                minTemperatureC = 15,
                maxTemperatureC = 35,
                placeTags
            }
            : new
            {
                name = PostgreSqlApiFactory.UniqueCategoryName(prefix),
                type,
                defaultDurationHours = 2,
                requiresDaylight = false,
                placeTags
            };
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", category);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>();
        return created!.Id;
    }

    private async Task<string> PostRawAsync(object body)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(Now);
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, body);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsStringAsync();
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(object body)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(Now);
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, body);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (response.StatusCode, document.RootElement.Clone());
    }
}
