using System.Net;
using System.Text.Json;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>GET /api/locations</c> as a Visitor, against the fake geocoding service (contracts/plan-setup-api.md).
/// The API caches answers and the cache is shared by the collection, so every test searches its own text.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class LocationsEndpointTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task Search_ReturnsPlacesInLithuaniaWithTheirArea()
    {
        var text = UniqueText();
        factory.Geocoding.Script(
            text,
            new GeocodingPlace(598316, "Kaunas", 54.90156, 23.90909, "LT", "Kaunas", "Kaunas"),
            new GeocodingPlace(456172, "Riga", 56.946, 24.10589, "LV", "Riga", null),
            new GeocodingPlace(11301040, "Kauniai", 56.19924, 24.69617, "LT", "Panevėžys", "Biržai District Municipality"));

        var (status, body) = await GetAsync(text);

        Assert.Equal(HttpStatusCode.OK, status);
        var locations = body.GetProperty("locations").EnumerateArray().ToList();
        Assert.Equal(2, locations.Count);
        var kaunas = locations[0];
        Assert.Equal(598316, kaunas.GetProperty("id").GetInt64());
        Assert.Equal("Kaunas", kaunas.GetProperty("name").GetString());
        Assert.Equal("Kaunas County", kaunas.GetProperty("area").GetString());
        Assert.Equal(54.90156, kaunas.GetProperty("latitude").GetDouble());
        Assert.Equal(23.90909, kaunas.GetProperty("longitude").GetDouble());
        Assert.Equal("Biržai District Municipality", locations[1].GetProperty("area").GetString());
    }

    [Fact]
    public async Task Search_WithNoMatch_ReturnsAnEmptyList()
    {
        var (status, body) = await GetAsync(UniqueText());

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(0, body.GetProperty("locations").GetArrayLength());
    }

    [Fact]
    public async Task Search_UsesOnlyTheTextBeforeTheFirstComma()
    {
        var text = UniqueText();
        factory.Geocoding.Script(text, new GeocodingPlace(1001, "Alytus", 54.4, 24.05, "LT", "Alytus", null));

        var (status, body) = await GetAsync($"{text}, Kaunas Count");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("Alytus", body.GetProperty("locations")[0].GetProperty("name").GetString());
    }

    [Theory]
    [InlineData("?query=a")]
    [InlineData("?query=%20%20%20")]
    [InlineData("?query=")]
    [InlineData("")]
    public async Task Search_WithTooShortOrMissingText_IsRefused(string queryString)
    {
        using var client = factory.CreateHttpsClient();

        using var response = await client.GetAsync($"/api/locations{queryString}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");
        Assert.Equal("Enter between 2 and 100 characters.", errors.GetProperty("query")[0].GetString());
    }

    [Fact]
    public async Task Search_WithTextLongerThan100Characters_IsRefused()
    {
        var (status, body) = await GetAsync(new string('x', 101));

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.True(body.GetProperty("errors").TryGetProperty("query", out _));
    }

    [Theory]
    [InlineData(FailureKind.Timeout)]
    [InlineData(FailureKind.Network)]
    [InlineData(FailureKind.UnexpectedStatus)]
    [InlineData(FailureKind.InvalidResponse)]
    public async Task ServiceFailure_Returns503WithTheServiceMessage(FailureKind kind)
    {
        var text = UniqueText();
        factory.Geocoding.ScriptFailure(text, kind);

        var (status, body) = await GetAsync(text);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("Service unavailable.", body.GetProperty("title").GetString());
        Assert.Equal("Location search is unavailable. Try again later.", body.GetProperty("detail").GetString());
        Assert.False(body.TryGetProperty("locations", out _));
    }

    private static string UniqueText() => $"Place {Guid.NewGuid():N}";

    private async Task<(HttpStatusCode Status, JsonElement Body)> GetAsync(string query)
    {
        using var client = factory.CreateHttpsClient();
        using var response = await client.GetAsync($"/api/locations?query={Uri.EscapeDataString(query)}");
        return (response.StatusCode, await ReadJsonAsync(response));
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }
}
