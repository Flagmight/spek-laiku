using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>Reading and editing one category, and the version check (contracts/categories-api.md, spec US2).</summary>
[Collection(PostgreSqlCollection.Name)]
public class AdminCategoriesUpdateEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/admin/categories";
    private const string ConflictMessage = "This category was changed by someone else. Reload it and try again.";

    [Fact]
    public async Task Update_WithCurrentVersion_Returns200WithNewValuesAndNewVersion()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var created = await CreateOutdoorAsync(client);
        var name = PostgreSqlApiFactory.UniqueCategoryName("Kayak trip");

        var response = await client.PutAsJsonAsync(
            $"{Path}/{created.Id}",
            OutdoorBody(name, created.Version, maxWindMs: 6, placeTags: "leisure=slipway"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReadCategoryAsync(response);
        Assert.Equal(created.Id, updated.Id);
        Assert.Equal(name, updated.Name);
        Assert.Equal(6m, updated.MaxWindMs);
        Assert.Equal(["leisure=slipway"], updated.PlaceTags);
        Assert.NotEqual(created.Version, updated.Version);
    }

    [Fact]
    public async Task Update_WithOldVersion_Returns409AndKeepsTheFirstUpdate()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var created = await CreateOutdoorAsync(client);
        var first = await client.PutAsJsonAsync(
            $"{Path}/{created.Id}", OutdoorBody(created.Name, created.Version, maxWindMs: 6));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await client.PutAsJsonAsync(
            $"{Path}/{created.Id}", OutdoorBody(created.Name, created.Version, maxWindMs: 12));

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        var problem = await second.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ConflictMessage, problem.GetProperty("title").GetString());
        Assert.Equal(ConflictMessage, problem.GetProperty("detail").GetString());
        Assert.Equal(6m, (await GetAsync(client, created.Id)).MaxWindMs);
    }

    [Fact]
    public async Task Get_ReturnsTheStoredValues()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var created = await CreateOutdoorAsync(client);

        var stored = await GetAsync(client, created.Id);

        Assert.Equal(created.Name, stored.Name);
        Assert.Equal(created.Version, stored.Version);
        Assert.Equal(["leisure=slipway", "sport=canoe"], stored.PlaceTags);
    }

    [Fact]
    public async Task GetAndUpdate_UnknownId_Return404CategoryNotFound()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var unknown = Guid.NewGuid();

        var get = await client.GetAsync($"{Path}/{unknown}");
        var update = await client.PutAsJsonAsync($"{Path}/{unknown}", OutdoorBody("Unknown", 1));

        foreach (var response in new[] { get, update })
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Category not found.", problem.GetProperty("title").GetString());
            Assert.Equal("Category not found.", problem.GetProperty("detail").GetString());
        }
    }

    [Fact]
    public async Task Update_OutdoorToIndoor_ReturnsNullLimits()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var created = await CreateOutdoorAsync(client);

        var response = await client.PutAsJsonAsync($"{Path}/{created.Id}", new
        {
            name = created.Name,
            type = "Indoor",
            defaultDurationHours = 2,
            requiresDaylight = false,
            maxWindMs = 8,
            maxRainMmPerHour = 0.5,
            minTemperatureC = 15,
            maxTemperatureC = 35,
            placeTags = "tourism=museum",
            version = created.Version
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReadCategoryAsync(response);
        Assert.Equal("Indoor", updated.Type);
        Assert.Null(updated.MaxWindMs);
        Assert.Null(updated.MaxRainMmPerHour);
        Assert.Null(updated.MinTemperatureC);
        Assert.Null(updated.MaxTemperatureC);
    }

    [Fact]
    public async Task Update_InvalidFieldsWithOldVersion_Returns400Not409()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var created = await CreateOutdoorAsync(client);

        var response = await client.PutAsJsonAsync(
            $"{Path}/{created.Id}", OutdoorBody(created.Name, created.Version + 1, maxWindMs: 31));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal(["maxWindMs"], errors.EnumerateObject().Select(property => property.Name));
    }

    [Fact]
    public async Task Create_LocationPointsToTheGetEndpoint()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var created = await client.PostAsJsonAsync(Path, OutdoorBody(PostgreSqlApiFactory.UniqueCategoryName("Located"), 0));

        var location = created.Headers.Location;
        Assert.NotNull(location);
        var stored = await client.GetAsync(location);

        Assert.Equal(HttpStatusCode.OK, stored.StatusCode);
    }

    private static object OutdoorBody(
        string name,
        uint version,
        decimal maxWindMs = 8,
        string placeTags = "leisure=slipway, sport=canoe") => new
        {
            name,
            type = "Outdoor",
            defaultDurationHours = 2,
            requiresDaylight = true,
            maxWindMs,
            maxRainMmPerHour = 0.5,
            minTemperatureC = 15,
            maxTemperatureC = 35,
            placeTags,
            version
        };

    private static async Task<ActivityCategoryResponse> CreateOutdoorAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            Path, OutdoorBody(PostgreSqlApiFactory.UniqueCategoryName("Kayaking"), 0));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadCategoryAsync(response);
    }

    private static async Task<ActivityCategoryResponse> GetAsync(HttpClient client, Guid id)
    {
        var response = await client.GetAsync($"{Path}/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadCategoryAsync(response);
    }

    private static async Task<ActivityCategoryResponse> ReadCategoryAsync(HttpResponseMessage response)
    {
        var category = await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>(JsonSerializerOptions.Web);
        return Assert.IsType<ActivityCategoryResponse>(category);
    }
}
