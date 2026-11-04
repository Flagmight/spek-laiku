using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plan-setup/check</c> as a Visitor (contracts/plan-setup-api.md, spec FR-012). Each test
/// sets the forecast period's clock and uses its own place id, because found places are cached.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanSetupCheckEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-setup/check";
    private const string LocationMessage = "Select a location in Lithuania from the list.";

    [Fact]
    public async Task ValidSetup_ReturnsTheServicesPlaceSortedDatesAndTheDefaultDistance()
    {
        var id = ScriptPlace("LT");

        var (status, body) = await PostAsync(new { locationId = id, dates = new[] { "2026-11-08", "2026-11-07" } });

        Assert.Equal(HttpStatusCode.OK, status);
        var location = body.GetProperty("location");
        Assert.Equal(id, location.GetProperty("id").GetInt64());
        Assert.Equal("Testinė", location.GetProperty("name").GetString());
        Assert.Equal("Kaunas County", location.GetProperty("area").GetString());
        Assert.Equal(54.9, location.GetProperty("latitude").GetDouble());
        Assert.Equal(23.9, location.GetProperty("longitude").GetDouble());
        Assert.Equal(["2026-11-07", "2026-11-08"], Strings(body.GetProperty("dates")));
        Assert.Equal(30, body.GetProperty("maxTravelDistanceKm").GetInt32());
    }

    [Fact]
    public async Task EveryFailingField_IsReturnedTogetherInContractOrder()
    {
        var (status, body) = await PostAsync(
            new { locationId = (long?)null, dates = new[] { "2026-11-11", "2026-11-03" }, maxTravelDistanceKm = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = body.GetProperty("errors");
        Assert.Equal(["locationId", "dates[0]", "dates[1]", "maxTravelDistanceKm"], Keys(errors));
        Assert.Equal(LocationMessage, Message(errors, "locationId"));
        Assert.Equal("Forecast is not available that far ahead.", Message(errors, "dates[0]"));
        Assert.Equal("Dates cannot be in the past.", Message(errors, "dates[1]"));
        Assert.Equal("Enter a whole number between 1 and 200.", Message(errors, "maxTravelDistanceKm"));
    }

    [Fact]
    public async Task EmptyBody_AsksForALocationAndADate()
    {
        var (status, body) = await PostAsync(new { });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = body.GetProperty("errors");
        Assert.Equal(["locationId", "dates"], Keys(errors));
        Assert.Equal("Add at least one date.", Message(errors, "dates"));
    }

    [Theory]
    // Winter, UTC+2: the Lithuanian date changes at 22:00 UTC.
    [InlineData("2026-11-04T21:59:00Z", "2026-11-04", HttpStatusCode.OK)]
    [InlineData("2026-11-04T22:00:00Z", "2026-11-04", HttpStatusCode.BadRequest)]
    [InlineData("2026-11-04T21:59:00Z", "2026-11-11", HttpStatusCode.BadRequest)]
    [InlineData("2026-11-04T22:00:00Z", "2026-11-11", HttpStatusCode.OK)]
    public async Task Dates_AreJudgedByTheDateInLithuania(string utcNow, string date, HttpStatusCode expected)
    {
        var id = ScriptPlace("LT");

        var (status, _) = await PostAsync(new { locationId = id, dates = new[] { date } }, utcNow);

        Assert.Equal(expected, status);
    }

    [Fact]
    public async Task RepeatedDate_IsReportedAtTheLaterIndex()
    {
        var id = ScriptPlace("LT");

        var (_, body) = await PostAsync(new { locationId = id, dates = new[] { "2026-11-07", "2026-11-07" } });

        var errors = body.GetProperty("errors");
        Assert.Equal(["dates[1]"], Keys(errors));
        Assert.Equal("This date is already added.", Message(errors, "dates[1]"));
    }

    [Fact]
    public async Task EightDates_GiveOnlyTheCountMessage()
    {
        var id = ScriptPlace("LT");
        var dates = Enumerable.Range(4, 7).Select(day => $"2026-11-{day:00}").Append("2026-11-03").ToArray();

        var (_, body) = await PostAsync(new { locationId = id, dates });

        var errors = body.GetProperty("errors");
        Assert.Equal(["dates"], Keys(errors));
        Assert.Equal("You can add up to 7 dates.", Message(errors, "dates"));
    }

    [Theory]
    [InlineData("12.5")]
    [InlineData("201")]
    public async Task DistanceThatIsNotAWholeNumberFrom1To200_IsRefused(string distance)
    {
        var id = ScriptPlace("LT");

        var (status, body) = await PostJsonAsync(
            $$"""{ "locationId": {{id}}, "dates": ["2026-11-07"], "maxTravelDistanceKm": {{distance}} }""");

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal(["maxTravelDistanceKm"], Keys(body.GetProperty("errors")));
    }

    [Fact]
    public async Task DistanceInRange_IsKept()
    {
        var id = ScriptPlace("LT");

        var (_, body) = await PostAsync(new { locationId = id, dates = new[] { "2026-11-07" }, maxTravelDistanceKm = 200 });

        Assert.Equal(200, body.GetProperty("maxTravelDistanceKm").GetInt32());
    }

    [Fact]
    public async Task IdTheServiceDoesNotKnow_IsRefused()
    {
        var (status, body) = await PostAsync(new { locationId = UniqueId(), dates = new[] { "2026-11-07" } });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal(LocationMessage, Message(body.GetProperty("errors"), "locationId"));
    }

    [Fact]
    public async Task PlaceOutsideLithuania_IsRefused()
    {
        var id = ScriptPlace("LV");

        var (status, body) = await PostAsync(new { locationId = id, dates = new[] { "2026-11-07" } });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal(["locationId"], Keys(body.GetProperty("errors")));
    }

    [Theory]
    [InlineData("""{ "maxTravelDistanceKm": "30" }""")]
    [InlineData("""{ "dates": ["7/11/2026"] }""")]
    [InlineData("not json")]
    public async Task UnreadableBody_IsOneRequestError(string json)
    {
        var (status, body) = await PostJsonAsync(json);

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = body.GetProperty("errors");
        Assert.Equal(["request"], Keys(errors));
        Assert.Equal("The request is invalid.", Message(errors, "request"));
    }

    [Fact]
    public async Task ServiceFailureDuringTheLookup_Returns503()
    {
        var id = UniqueId();
        factory.Geocoding.ScriptGetFailure(id, FailureKind.Timeout);

        var (status, body) = await PostAsync(new { locationId = id, dates = new[] { "2026-11-07" } });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("Location search is unavailable. Try again later.", body.GetProperty("detail").GetString());
    }

    private static long UniqueId() => Random.Shared.NextInt64(100_000_000, 999_999_999);

    private long ScriptPlace(string countryCode)
    {
        var id = UniqueId();
        factory.Geocoding.ScriptPlace(new GeocodingPlace(id, "Testinė", 54.9, 23.9, countryCode, "Kaunas", null));
        return id;
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(
        object body,
        string utcNow = "2026-11-04T10:00:00Z")
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(utcNow);
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, body);
        return (response.StatusCode, await ReadJsonAsync(response));
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostJsonAsync(string json)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse("2026-11-04T10:00:00Z");
        using var client = factory.CreateHttpsClient();
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(Path, content);
        return (response.StatusCode, await ReadJsonAsync(response));
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    private static List<string> Keys(JsonElement errors) => errors.EnumerateObject().Select(error => error.Name).ToList();

    private static List<string?> Strings(JsonElement array) => array.EnumerateArray().Select(item => item.GetString()).ToList();

    private static string? Message(JsonElement errors, string key) => errors.GetProperty(key)[0].GetString();
}
