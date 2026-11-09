using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plan-activities/check</c> as a Visitor (contracts/plan-activities-api.md). The shared
/// database also holds other tests' categories, so each test adds its own.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanActivitiesCheckEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-activities/check";
    private const string Duration = "Enter a duration between 0.5 and 12 hours.";

    [Fact]
    public async Task ValidActivities_ReturnTheContractBodyInRequestOrder()
    {
        var name = PostgreSqlApiFactory.UniqueCategoryName("Check outdoor");
        var indoorName = PostgreSqlApiFactory.UniqueCategoryName("Check indoor");
        var outdoorId = await AddOutdoorCategoryAsync(name);
        var indoorId = await AddIndoorCategoryAsync(indoorName);

        var (status, body) = await PostAsync(new
        {
            activities = new object[]
            {
                OutdoorActivity(outdoorId, durationHours: 2.5),
                new
                {
                    categoryId = indoorId,
                    type = "Indoor",
                    durationHours = 1,
                    requiresDaylight = true,
                    maxWindMs = 999,
                    maxRainMmPerHour = 999,
                    minTemperatureC = 999,
                    maxTemperatureC = 999
                },
                OutdoorActivity(outdoorId, durationHours: 4, minTemperatureC: 18)
            }
        });

        Assert.Equal(HttpStatusCode.OK, status);
        var activities = body.GetProperty("activities").EnumerateArray().ToList();
        Assert.Equal(3, activities.Count);
        Assert.Equal(
            [
                "categoryId",
                "name",
                "type",
                "durationHours",
                "requiresDaylight",
                "maxWindMs",
                "maxRainMmPerHour",
                "minTemperatureC",
                "maxTemperatureC"
            ],
            activities[0].EnumerateObject().Select(property => property.Name));
        Assert.Equal(outdoorId, activities[0].GetProperty("categoryId").GetGuid());
        Assert.Equal(name, activities[0].GetProperty("name").GetString());
        Assert.Equal("Outdoor", activities[0].GetProperty("type").GetString());
        Assert.Equal(2.5m, activities[0].GetProperty("durationHours").GetDecimal());
        Assert.True(activities[0].GetProperty("requiresDaylight").GetBoolean());
        Assert.Equal(8m, activities[0].GetProperty("maxWindMs").GetDecimal());
        Assert.Equal(0.5m, activities[0].GetProperty("maxRainMmPerHour").GetDecimal());
        Assert.Equal(15m, activities[0].GetProperty("minTemperatureC").GetDecimal());
        Assert.Equal(35m, activities[0].GetProperty("maxTemperatureC").GetDecimal());

        Assert.Equal(indoorName, activities[1].GetProperty("name").GetString());
        Assert.Equal("Indoor", activities[1].GetProperty("type").GetString());
        Assert.Equal(JsonValueKind.Null, activities[1].GetProperty("maxWindMs").ValueKind);
        Assert.Equal(JsonValueKind.Null, activities[1].GetProperty("maxRainMmPerHour").ValueKind);
        Assert.Equal(JsonValueKind.Null, activities[1].GetProperty("minTemperatureC").ValueKind);
        Assert.Equal(JsonValueKind.Null, activities[1].GetProperty("maxTemperatureC").ValueKind);

        Assert.Equal(4m, activities[2].GetProperty("durationHours").GetDecimal());
        Assert.Equal(18m, activities[2].GetProperty("minTemperatureC").GetDecimal());
    }

    [Fact]
    public async Task EveryProblem_IsReturnedTogetherInContractOrder()
    {
        var outdoorId = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Check errors"));

        var (status, body) = await PostAsync(new
        {
            activities = new object[]
            {
                OutdoorActivity(outdoorId, durationHours: 0.25),
                OutdoorActivity(Guid.NewGuid()),
                OutdoorActivity(outdoorId, type: "Indoor")
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal("One or more request fields are invalid.", body.GetProperty("title").GetString());
        var errors = body.GetProperty("errors");
        Assert.Equal(["activities[0].durationHours", "activities[1]", "activities[2]"], Keys(errors));
        Assert.Equal(Duration, Message(errors, "activities[0].durationHours"));
        Assert.Equal("This activity is no longer available. Remove it.", Message(errors, "activities[1]"));
        Assert.Equal(
            "This activity's category has changed. Remove it and add it again.",
            Message(errors, "activities[2]"));
    }

    [Fact]
    public async Task EmptyList_AsksForAnActivity()
    {
        var (status, body) = await PostAsync(new { activities = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = body.GetProperty("errors");
        Assert.Equal(["activities"], Keys(errors));
        Assert.Equal("Add at least one activity.", Message(errors, "activities"));
    }

    [Fact]
    public async Task ElevenActivities_AreRefusedByCount()
    {
        var activities = Enumerable.Range(0, 11).Select(_ => OutdoorActivity(Guid.NewGuid())).ToArray();

        var (status, body) = await PostAsync(new { activities });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = body.GetProperty("errors");
        Assert.Equal(["activities"], Keys(errors));
        Assert.Equal("You can add up to 10 activities.", Message(errors, "activities"));
    }

    [Theory]
    [InlineData("""{ "activities": [ { "categoryId": "6f1c2c1e-5d8c-4a5e-9b1a-2b7f0c3e9d41", "durationHours": "2" } ] }""")]
    [InlineData("""{ "activities": [ { "categoryId": "not-a-guid" } ] }""")]
    public async Task WrongJsonTypes_GiveTheRequestError(string json)
    {
        using var client = factory.CreateHttpsClient();
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(Path, content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");
        Assert.Equal(["request"], Keys(errors));
        Assert.Equal("The request is invalid.", Message(errors, "request"));
    }

    [Fact]
    public async Task NullItemInTheList_GivesTheActivityMessage()
    {
        using var client = factory.CreateHttpsClient();
        using var content = new StringContent("""{ "activities": [ null ] }""", Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(Path, content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");
        Assert.Equal(["activities[0]"], Keys(errors));
    }

    [Fact]
    public async Task Response_UsesTheCategorysCurrentNameAfterARename()
    {
        var name = PostgreSqlApiFactory.UniqueCategoryName("Check rename");
        var id = await AddOutdoorCategoryAsync(name);
        var request = new { activities = new[] { OutdoorActivity(id) } };

        var (_, before) = await PostAsync(request);
        Assert.Equal(name, before.GetProperty("activities")[0].GetProperty("name").GetString());

        var newName = PostgreSqlApiFactory.UniqueCategoryName("Check renamed");
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await context.ActivityCategories
                .Where(category => category.Id == id)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(category => category.Name, newName)
                    .SetProperty(category => category.NormalizedName, newName.ToUpperInvariant()));
        }

        var (_, after) = await PostAsync(request);
        Assert.Equal(newName, after.GetProperty("activities")[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task PlansOwnValues_LeaveTheCategoryUnchanged()
    {
        var id = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Check unchanged"));
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        var before = await ReadCategoryAsync(administrator, id);

        var (status, _) = await PostAsync(new
        {
            activities = new[]
            {
                new
                {
                    categoryId = id,
                    type = "Outdoor",
                    durationHours = 6.5,
                    requiresDaylight = false,
                    maxWindMs = 3,
                    maxRainMmPerHour = 7,
                    minTemperatureC = 1,
                    maxTemperatureC = 2
                }
            }
        });

        Assert.Equal(HttpStatusCode.OK, status);
        var after = await ReadCategoryAsync(administrator, id);
        Assert.Equal(before.DefaultDurationHours, after.DefaultDurationHours);
        Assert.Equal(before.RequiresDaylight, after.RequiresDaylight);
        Assert.Equal(before.MaxWindMs, after.MaxWindMs);
        Assert.Equal(before.MaxRainMmPerHour, after.MaxRainMmPerHour);
        Assert.Equal(before.MinTemperatureC, after.MinTemperatureC);
        Assert.Equal(before.MaxTemperatureC, after.MaxTemperatureC);
        Assert.Equal(before.Version, after.Version);
    }

    [Fact]
    public async Task BoundaryValues_AreAccepted()
    {
        var id = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Check accepted"));

        var (status, _) = await PostAsync(new
        {
            activities = new[]
            {
                Limits(id, durationHours: 0.5, maxWindMs: 0, maxRainMmPerHour: 0, minTemperatureC: -30, maxTemperatureC: 45),
                Limits(id, durationHours: 12, maxWindMs: 30, maxRainMmPerHour: 20, minTemperatureC: 44.9, maxTemperatureC: 45)
            }
        });

        Assert.Equal(HttpStatusCode.OK, status);
    }

    [Fact]
    public async Task ValuesJustOutsideTheBoundaries_AreRefusedAtTheirFields()
    {
        var id = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Check refused"));

        var (status, body) = await PostAsync(new
        {
            activities = new[]
            {
                Limits(id, durationHours: 0.25, maxWindMs: 1.25, maxRainMmPerHour: 20.5, minTemperatureC: 20, maxTemperatureC: 20),
                Limits(id, durationHours: 12.5, maxWindMs: 8, maxRainMmPerHour: 0.5, minTemperatureC: -30.5, maxTemperatureC: 45.5)
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = body.GetProperty("errors");
        Assert.Equal(
            [
                "activities[0].durationHours",
                "activities[0].maxWindMs",
                "activities[0].maxRainMmPerHour",
                "activities[0].minTemperatureC",
                "activities[1].durationHours",
                "activities[1].minTemperatureC",
                "activities[1].maxTemperatureC"
            ],
            Keys(errors));
        Assert.Equal(Duration, Message(errors, "activities[0].durationHours"));
        Assert.Equal("Enter a wind limit between 0 and 30 m/s.", Message(errors, "activities[0].maxWindMs"));
        Assert.Equal("Enter a rain limit between 0 and 20 mm/h.", Message(errors, "activities[0].maxRainMmPerHour"));
        Assert.Equal(
            "Minimum temperature must be lower than maximum temperature.",
            Message(errors, "activities[0].minTemperatureC"));
        Assert.Equal(
            "Enter a minimum temperature between -30 and 45 °C.",
            Message(errors, "activities[1].minTemperatureC"));
        Assert.Equal(
            "Enter a maximum temperature between -30 and 45 °C.",
            Message(errors, "activities[1].maxTemperatureC"));
    }

    private static object Limits(
        Guid categoryId,
        double durationHours,
        double maxWindMs,
        double maxRainMmPerHour,
        double minTemperatureC,
        double maxTemperatureC) => new
        {
            categoryId,
            type = "Outdoor",
            durationHours,
            requiresDaylight = true,
            maxWindMs,
            maxRainMmPerHour,
            minTemperatureC,
            maxTemperatureC
        };

    private static async Task<ActivityCategoryResponse> ReadCategoryAsync(HttpClient administrator, Guid id)
    {
        using var response = await administrator.GetAsync($"/api/admin/categories/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>())!;
    }

    private static object OutdoorActivity(
        Guid categoryId,
        double durationHours = 2,
        string type = "Outdoor",
        double minTemperatureC = 15) => new
        {
            categoryId,
            type,
            durationHours,
            requiresDaylight = true,
            maxWindMs = 8,
            maxRainMmPerHour = 0.5,
            minTemperatureC,
            maxTemperatureC = 35
        };

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(object body)
    {
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, body);
        return (response.StatusCode, await ReadJsonAsync(response));
    }

    private Task<Guid> AddOutdoorCategoryAsync(string name) => AddCategoryAsync(new
    {
        name,
        type = "Outdoor",
        defaultDurationHours = 2,
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

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    private static List<string> Keys(JsonElement errors) => errors.EnumerateObject().Select(error => error.Name).ToList();

    private static string? Message(JsonElement errors, string key) => errors.GetProperty(key)[0].GetString();
}
