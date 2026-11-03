using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Every refused value gets its message and nothing is stored (contracts/categories-api.md, spec US3).
/// The tests in the collection run one at a time, so the list must be unchanged after a refusal.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AdminCategoriesValidationEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/admin/categories";

    [Fact]
    public async Task EmptyObject_ReturnsTheRequiredFieldsOnly()
    {
        var errors = await PostRefusedAsync("{}");

        Assert.Equal(["name", "type", "defaultDurationHours", "placeTags"], Keys(errors));
    }

    [Fact]
    public async Task OutdoorWithoutLimits_AlsoReturnsTheFourLimitKeys()
    {
        var errors = await PostRefusedAsync("""{ "type": "Outdoor" }""");

        Assert.Equal(
            ["name", "defaultDurationHours", "maxWindMs", "maxRainMmPerHour", "minTemperatureC", "maxTemperatureC",
                "placeTags"],
            Keys(errors));
    }

    [Theory]
    [InlineData("name", "\"   \"", "Enter a category name.")]
    [InlineData("name", "\"A\"", "Category name must be between 2 and 60 characters.")]
    [InlineData("type", "\"outdoor\"", "Select a type.")]
    [InlineData("defaultDurationHours", "12.5", "Enter a duration between 0.5 and 12 hours.")]
    [InlineData("defaultDurationHours", "1.3", "Enter a duration between 0.5 and 12 hours.")]
    [InlineData("maxWindMs", "30.1", "Enter a wind limit between 0 and 30 m/s.")]
    [InlineData("maxWindMs", "1.25", "Enter a wind limit between 0 and 30 m/s.")]
    [InlineData("maxRainMmPerHour", "-0.1", "Enter a rain limit between 0 and 20 mm/h.")]
    [InlineData("minTemperatureC", "-30.1", "Enter a minimum temperature between -30 and 45 °C.")]
    [InlineData("maxTemperatureC", "45.1", "Enter a maximum temperature between -30 and 45 °C.")]
    [InlineData("placeTags", "\"slipway\"", "Enter tags in the form key=value, for example leisure=slipway.")]
    [InlineData("placeTags", "\"leisure=\"", "Enter tags in the form key=value, for example leisure=slipway.")]
    [InlineData("placeTags", "\"historic=*\"", "Enter tags in the form key=value, for example leisure=slipway.")]
    [InlineData("placeTags", "\"historic\"", "Enter tags in the form key=value, for example leisure=slipway.")]
    public async Task InvalidValue_ReturnsItsMessageOnly(string field, string json, string message)
    {
        var errors = await PostRefusedAsync(OutdoorJson((field, json)));

        Assert.Equal([field], Keys(errors));
        Assert.Equal(message, errors.GetProperty(field)[0].GetString());
    }

    [Fact]
    public async Task PlaceTagsLongerThan200Characters_ReturnsTheLengthMessage()
    {
        var tags = "k=" + new string('v', 199);

        var errors = await PostRefusedAsync(OutdoorJson(("placeTags", JsonSerializer.Serialize(tags))));

        Assert.Equal("Map place tags can be at most 200 characters.", errors.GetProperty("placeTags")[0].GetString());
    }

    [Theory]
    [InlineData("20", "20")]
    [InlineData("25", "20")]
    public async Task MinimumNotLowerThanMaximum_ReturnsTheOrderMessageOnMinimum(string min, string max)
    {
        var errors = await PostRefusedAsync(OutdoorJson(("minTemperatureC", min), ("maxTemperatureC", max)));

        Assert.Equal(["minTemperatureC"], Keys(errors));
        Assert.Equal(
            "Minimum temperature must be lower than maximum temperature.",
            errors.GetProperty("minTemperatureC")[0].GetString());
    }

    [Theory]
    [InlineData("0", "0", "-30", "-29.9", "0.5")]
    [InlineData("30", "20", "44.9", "45", "12")]
    public async Task BoundaryValues_AreAccepted(
        string wind, string rain, string min, string max, string duration)
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");

        var response = await PostJsonAsync(client, OutdoorJson(
            ("maxWindMs", wind),
            ("maxRainMmPerHour", rain),
            ("minTemperatureC", min),
            ("maxTemperatureC", max),
            ("defaultDurationHours", duration)));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task PlaceTags_AreStoredNormalizedWithoutDuplicates()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");

        var response = await PostJsonAsync(client, OutdoorJson(
            ("placeTags", "\" leisure = slipway ,, sport=canoe , leisure=slipway\"")));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>(JsonSerializerOptions.Web);
        Assert.Equal(["leisure=slipway", "sport=canoe"], created!.PlaceTags);
    }

    [Theory]
    [InlineData("{ not json")]
    [InlineData("""{ "name": "Swimming", "maxWindMs": "8" }""")]
    public async Task UnreadableBody_ReturnsTheRequestError(string json)
    {
        var errors = await PostRefusedAsync(json);

        Assert.Equal(["request"], Keys(errors));
        Assert.Equal("The request is invalid.", errors.GetProperty("request")[0].GetString());
    }

    [Fact]
    public async Task FormEncodedBody_Returns415AndStoresNothing()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var before = await ListIdsAsync(client);

        var response = await client.PostAsync(Path, new FormUrlEncodedContent(
            new Dictionary<string, string> { ["name"] = "Swimming", ["type"] = "Indoor" }));

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
        Assert.Equal(before, await ListIdsAsync(client));
    }

    // A valid Outdoor body with a unique name, with some properties replaced by raw JSON values.
    private static string OutdoorJson(params (string Field, string Json)[] replacements)
    {
        var properties = new Dictionary<string, string>
        {
            ["name"] = JsonSerializer.Serialize(PostgreSqlApiFactory.UniqueCategoryName("Validation")),
            ["type"] = "\"Outdoor\"",
            ["defaultDurationHours"] = "2",
            ["requiresDaylight"] = "true",
            ["maxWindMs"] = "8",
            ["maxRainMmPerHour"] = "0.5",
            ["minTemperatureC"] = "15",
            ["maxTemperatureC"] = "35",
            ["placeTags"] = "\"leisure=slipway\""
        };
        foreach (var (field, json) in replacements)
        {
            properties[field] = json;
        }

        return "{" + string.Join(", ", properties.Select(property => $"\"{property.Key}\": {property.Value}")) + "}";
    }

    private async Task<JsonElement> PostRefusedAsync(string json)
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var before = await ListIdsAsync(client);

        var response = await PostJsonAsync(client, json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(before, await ListIdsAsync(client));
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("One or more request fields are invalid.", body.GetProperty("title").GetString());
        return body.GetProperty("errors");
    }

    private static Task<HttpResponseMessage> PostJsonAsync(HttpClient client, string json) =>
        client.PostAsync(Path, new StringContent(json, Encoding.UTF8, "application/json"));

    private static async Task<List<Guid>> ListIdsAsync(HttpClient client)
    {
        var categories = await client.GetFromJsonAsync<List<ActivityCategoryResponse>>(Path, JsonSerializerOptions.Web);
        return [.. categories!.Select(category => category.Id)];
    }

    private static IEnumerable<string> Keys(JsonElement errors) =>
        errors.EnumerateObject().Select(property => property.Name);
}
