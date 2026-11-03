using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>Listing and creating categories through the API (contracts/categories-api.md, spec US1).</summary>
[Collection(PostgreSqlCollection.Name)]
public class AdminCategoriesCreateEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/admin/categories";

    [Fact]
    public async Task List_ReturnsStarterCategoriesWithEveryFieldOrderedByNormalizedName()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");

        var categories = await ListAsync(client);

        // Other tests add categories to the shared database, so only the starter rows are checked.
        var kayaking = Assert.Single(categories, category => category.Id == StarterCategories.KayakingId);
        Assert.Equal("Kayaking", kayaking.Name);
        Assert.Equal("Outdoor", kayaking.Type);
        Assert.Equal(2.0m, kayaking.DefaultDurationHours);
        Assert.True(kayaking.RequiresDaylight);
        Assert.Equal(8.0m, kayaking.MaxWindMs);
        Assert.Equal(0.5m, kayaking.MaxRainMmPerHour);
        Assert.Equal(15.0m, kayaking.MinTemperatureC);
        Assert.Equal(35.0m, kayaking.MaxTemperatureC);
        Assert.Equal(["leisure=slipway", "sport=canoe"], kayaking.PlaceTags);
        Assert.NotEqual(0u, kayaking.Version);

        var museum = Assert.Single(categories, category => category.Id == StarterCategories.MuseumId);
        Assert.Equal("Indoor", museum.Type);
        Assert.Null(museum.MaxWindMs);
        Assert.Null(museum.MaxRainMmPerHour);
        Assert.Null(museum.MinTemperatureC);
        Assert.Null(museum.MaxTemperatureC);

        Assert.Contains(categories, category => category.Id == StarterCategories.CyclingId);
        Assert.Contains(categories, category => category.Id == StarterCategories.PicnicId);
        Assert.Contains(categories, category => category.Id == StarterCategories.HeritageSiteId);

        var names = categories.Select(category => category.Name.ToUpperInvariant()).ToList();
        Assert.Equal(names.Order(StringComparer.Ordinal), names);
    }

    [Fact]
    public async Task Create_Swimming_Returns201WithLocationAndTheCategory()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var name = PostgreSqlApiFactory.UniqueCategoryName("Swimming");

        var response = await client.PostAsJsonAsync(Path, new
        {
            name,
            type = "Outdoor",
            defaultDurationHours = 2,
            requiresDaylight = true,
            maxWindMs = 8,
            maxRainMmPerHour = 0.5,
            minTemperatureC = 18,
            maxTemperatureC = 35,
            placeTags = "leisure=bathing_place, sport=swimming"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await ReadCategoryAsync(response);
        // CreatedAtAction writes an absolute URL; the contract fixes its path.
        Assert.Equal($"/api/admin/categories/{created.Id}", response.Headers.Location?.AbsolutePath);
        Assert.Equal(
            new ActivityCategoryResponse(
                created.Id, name, "Outdoor", 2m, true, 8m, 0.5m, 18m, 35m, created.PlaceTags, created.Version),
            created);
        Assert.Equal(["leisure=bathing_place", "sport=swimming"], created.PlaceTags);
        Assert.NotEqual(0u, created.Version);

        Assert.Contains(await ListAsync(client), category => category.Id == created.Id && category.Name == name);
    }

    [Fact]
    public async Task Create_IndoorWithLimits_ReturnsNullLimits()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");

        var response = await client.PostAsJsonAsync(Path, new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName("Indoor pool"),
            type = "Indoor",
            defaultDurationHours = 1.5,
            requiresDaylight = false,
            maxWindMs = 99,
            maxRainMmPerHour = 1,
            minTemperatureC = 10,
            maxTemperatureC = 30,
            placeTags = "leisure=sports_centre"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await ReadCategoryAsync(response);
        Assert.Equal("Indoor", created.Type);
        Assert.Null(created.MaxWindMs);
        Assert.Null(created.MaxRainMmPerHour);
        Assert.Null(created.MinTemperatureC);
        Assert.Null(created.MaxTemperatureC);
    }

    [Fact]
    public async Task Create_NameOfAnExistingCategoryInOtherCase_Returns400WithNameMessage()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");

        var response = await client.PostAsJsonAsync(Path, IndoorBody(" kAYAKING "));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("One or more request fields are invalid.", body.GetProperty("title").GetString());
        var errors = body.GetProperty("errors");
        Assert.Equal(["name"], errors.EnumerateObject().Select(property => property.Name));
        Assert.Equal(
            "A category with this name already exists.",
            errors.GetProperty("name")[0].GetString());
    }

    [Fact]
    public async Task Create_InvalidFields_Returns400WithEveryMessageInFormOrder()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");

        var response = await client.PostAsJsonAsync(Path, new { requiresDaylight = false });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal(
            ["name", "type", "defaultDurationHours", "placeTags"],
            errors.EnumerateObject().Select(property => property.Name));
    }

    [Fact]
    public async Task Visitor_Gets401ForListAndCreateAndNothingIsStored()
    {
        using var client = factory.CreateHttpsClient();
        var name = PostgreSqlApiFactory.UniqueCategoryName("Visitor");

        var list = await client.GetAsync(Path);
        var create = await client.PostAsJsonAsync(Path, IndoorBody(name));

        Assert.Equal(HttpStatusCode.Unauthorized, list.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, create.StatusCode);
        Assert.Empty(await create.Content.ReadAsStringAsync());
        await AssertNotStoredAsync(name);
    }

    [Fact]
    public async Task ActiveRegisteredUser_Gets403ForListAndCreateAndNothingIsStored()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var name = PostgreSqlApiFactory.UniqueCategoryName("Registered");

        var list = await client.GetAsync(Path);
        var create = await client.PostAsJsonAsync(Path, IndoorBody(name));

        Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        await AssertNotStoredAsync(name);
    }

    private static object IndoorBody(string name) => new
    {
        name,
        type = "Indoor",
        defaultDurationHours = 2,
        requiresDaylight = false,
        placeTags = "tourism=museum"
    };

    private async Task AssertNotStoredAsync(string name)
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        Assert.DoesNotContain(await ListAsync(administrator), category => category.Name == name);
    }

    private static async Task<List<ActivityCategoryResponse>> ListAsync(HttpClient client)
    {
        var response = await client.GetAsync(Path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var categories = await response.Content.ReadFromJsonAsync<List<ActivityCategoryResponse>>(
            JsonSerializerOptions.Web);
        return Assert.IsType<List<ActivityCategoryResponse>>(categories);
    }

    private static async Task<ActivityCategoryResponse> ReadCategoryAsync(HttpResponseMessage response)
    {
        var category = await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>(JsonSerializerOptions.Web);
        return Assert.IsType<ActivityCategoryResponse>(category);
    }
}
