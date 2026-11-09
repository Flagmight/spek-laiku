using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>GET /api/plan-activities/categories</c> (contracts/plan-activities-api.md). The shared database also
/// holds the starter categories and those of other tests, so each test checks only the ones it adds.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanCategoriesEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-activities/categories";

    [Fact]
    public async Task Visitor_GetsTheCategoriesWithEveryValueAndTheActivityLimit()
    {
        var outdoorName = PostgreSqlApiFactory.UniqueCategoryName("Planning outdoor");
        var indoorName = PostgreSqlApiFactory.UniqueCategoryName("Planning indoor");
        var outdoorId = await AddOutdoorCategoryAsync(outdoorName);
        var indoorId = await AddIndoorCategoryAsync(indoorName);
        using var visitor = factory.CreateHttpsClient();

        using var response = await visitor.GetAsync(Path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PlanCategoriesResponse>();
        Assert.NotNull(body);
        Assert.Equal(10, body.MaxActivities);
        Assert.Equal(PlanActivityValidator.MaxActivities, body.MaxActivities);
        Assert.Equal(
            new PlanCategoryResponse(outdoorId, outdoorName, "Outdoor", 2.5m, true, 8m, 0.5m, 15m, 35m),
            Assert.Single(body.Categories, category => category.Id == outdoorId));
        Assert.Equal(
            new PlanCategoryResponse(indoorId, indoorName, "Indoor", 2m, false, null, null, null, null),
            Assert.Single(body.Categories, category => category.Id == indoorId));
    }

    [Fact]
    public async Task Categories_ComeInNameOrder()
    {
        var firstId = await AddIndoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Planning order A"));
        var secondId = await AddIndoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Planning order B"));
        using var visitor = factory.CreateHttpsClient();

        using var response = await visitor.GetAsync(Path);

        var body = await response.Content.ReadFromJsonAsync<PlanCategoriesResponse>();
        var ids = body!.Categories.Select(category => category.Id).ToList();
        Assert.True(ids.IndexOf(firstId) < ids.IndexOf(secondId));
        var names = body.Categories.Select(category => category.Name.ToUpperInvariant()).ToList();
        Assert.Equal(names.Order(StringComparer.Ordinal), names);
    }

    [Fact]
    public async Task Category_HasExactlyTheContractKeys_WithoutPlaceTagsOrVersion()
    {
        var id = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Planning keys"));
        using var visitor = factory.CreateHttpsClient();

        using var response = await visitor.GetAsync(Path);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var category = document.RootElement.GetProperty("categories").EnumerateArray()
            .Single(item => item.GetProperty("id").GetGuid() == id);
        Assert.Equal(
            [
                "id",
                "name",
                "type",
                "defaultDurationHours",
                "requiresDaylight",
                "maxWindMs",
                "maxRainMmPerHour",
                "minTemperatureC",
                "maxTemperatureC"
            ],
            category.EnumerateObject().Select(property => property.Name));
    }

    private Task<Guid> AddOutdoorCategoryAsync(string name) => AddCategoryAsync(new
    {
        name,
        type = "Outdoor",
        defaultDurationHours = 2.5,
        requiresDaylight = true,
        maxWindMs = 8,
        maxRainMmPerHour = 0.5,
        minTemperatureC = 15,
        maxTemperatureC = 35,
        placeTags = "leisure=slipway"
    });

    private Task<Guid> AddIndoorCategoryAsync(string name) => AddCategoryAsync(new
    {
        name,
        type = "Indoor",
        defaultDurationHours = 2,
        requiresDaylight = false,
        placeTags = "tourism=museum"
    });

    private async Task<Guid> AddCategoryAsync(object category)
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", category);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>();
        return created!.Id;
    }
}
