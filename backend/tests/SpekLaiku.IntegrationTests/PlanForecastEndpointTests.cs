using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plan-forecast</c> as a Visitor (contracts/plan-forecast-api.md), against the fake location and
/// weather services. Forecasts are cached per location id and day, so every test scripts its own place id and
/// position, and adds its own categories.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanForecastEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-forecast";

    // 14:20 on 2026-11-10 in Vilnius (UTC+2).
    private const string Now = "2026-11-10T12:20:00Z";

    private static readonly DateOnly Today = new(2026, 11, 10);

    [Fact]
    public async Task ValidPlan_ReturnsTheContractBody()
    {
        var place = ScriptPlace();
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(Today, 7, 18.04, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        var kayakingId = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Forecast kayaking"));
        var museumId = await AddIndoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Forecast museum"));

        var (status, body) = await PostAsync(new
        {
            setup = new { locationId = place.Id, dates = new[] { "2026-11-12", "2026-11-10" }, maxTravelDistanceKm = 30 },
            activities = new object[]
            {
                OutdoorActivity(kayakingId, minTemperatureC: 15),
                IndoorActivity(museumId),
                OutdoorActivity(kayakingId, minTemperatureC: 20)
            }
        });

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(["updatedAt", "days", "activities"], Keys(body));
        Assert.Equal("14:20", body.GetProperty("updatedAt").GetString());

        var days = body.GetProperty("days").EnumerateArray().ToList();
        Assert.Equal(["2026-11-10", "2026-11-12"], days.Select(day => day.GetProperty("date").GetString()));
        Assert.Equal(["date", "sunrise", "sunset", "hours"], Keys(days[0]));
        Assert.Equal("07:42", days[1].GetProperty("sunrise").GetString());
        Assert.Equal("16:20", days[1].GetProperty("sunset").GetString());

        // Today at 14:20: the hours from 15:00 are left. Another date has the 16 hours from 06:00.
        var today = days[0].GetProperty("hours").EnumerateArray().ToList();
        Assert.Equal("15:00", today[0].GetProperty("start").GetString());
        Assert.Equal(7, today.Count);
        var later = days[1].GetProperty("hours").EnumerateArray().ToList();
        Assert.Equal(16, later.Count);
        Assert.Equal("06:00", later[0].GetProperty("start").GetString());
        Assert.Equal("22:00", later[^1].GetProperty("end").GetString());
        Assert.Equal(["start", "end", "temperatureC", "rainMmPerHour", "windMs", "daylight"], Keys(later[2]));
        Assert.Equal(18.0m, later[2].GetProperty("temperatureC").GetDecimal());
        Assert.Equal(0.0m, later[2].GetProperty("rainMmPerHour").GetDecimal());
        Assert.Equal(3.0m, later[2].GetProperty("windMs").GetDecimal());
        Assert.True(later[2].GetProperty("daylight").GetBoolean());
        Assert.False(later[1].GetProperty("daylight").GetBoolean());

        var activities = body.GetProperty("activities").EnumerateArray().ToList();
        Assert.Equal(3, activities.Count);
        var kayaking = activities[0];
        Assert.Equal(["weatherIndependent", "suitableHours", "datesWithSuitableHours", "hasLongEnoughPeriod", "days"], Keys(kayaking));
        Assert.False(kayaking.GetProperty("weatherIndependent").GetBoolean());
        // Daylight 15:00–16:00 today and 08:00–16:00 on the 12th.
        Assert.Equal(9, kayaking.GetProperty("suitableHours").GetInt32());
        Assert.Equal(2, kayaking.GetProperty("datesWithSuitableHours").GetInt32());
        Assert.True(kayaking.GetProperty("hasLongEnoughPeriod").GetBoolean());

        var kayakingToday = kayaking.GetProperty("days")[0];
        Assert.Equal(["date", "periods", "hours"], Keys(kayakingToday));
        Assert.Equal("2026-11-10", kayakingToday.GetProperty("date").GetString());
        var shortPeriod = Assert.Single(kayakingToday.GetProperty("periods").EnumerateArray());
        Assert.Equal(["start", "end", "lengthHours", "shorterThanDuration"], Keys(shortPeriod));
        Assert.Equal("15:00", shortPeriod.GetProperty("start").GetString());
        Assert.Equal("16:00", shortPeriod.GetProperty("end").GetString());
        Assert.Equal(1, shortPeriod.GetProperty("lengthHours").GetInt32());
        Assert.True(shortPeriod.GetProperty("shorterThanDuration").GetBoolean());
        Assert.Equal(7, kayakingToday.GetProperty("hours").GetArrayLength());
        var fourPm = kayakingToday.GetProperty("hours")[1];
        Assert.Equal(["start", "suitable", "reasons"], Keys(fourPm));
        Assert.Equal("16:00", fourPm.GetProperty("start").GetString());
        Assert.False(fourPm.GetProperty("suitable").GetBoolean());
        Assert.Equal(["Outside daylight"], fourPm.GetProperty("reasons").EnumerateArray().Select(reason => reason.GetString()));

        var longPeriod = Assert.Single(kayaking.GetProperty("days")[1].GetProperty("periods").EnumerateArray());
        Assert.Equal(8, longPeriod.GetProperty("lengthHours").GetInt32());
        Assert.False(longPeriod.GetProperty("shorterThanDuration").GetBoolean());

        var museum = activities[1];
        Assert.True(museum.GetProperty("weatherIndependent").GetBoolean());
        Assert.Equal(7 + 16, museum.GetProperty("suitableHours").GetInt32());

        // The same category with a minimum of 20 °C has no suitable hour at 18 °C.
        Assert.Equal(0, activities[2].GetProperty("suitableHours").GetInt32());
        Assert.Equal(
            ["Too cold: 18.0 °C, minimum 20.0 °C"],
            activities[2].GetProperty("days")[1].GetProperty("hours")[3].GetProperty("reasons").EnumerateArray().Select(reason => reason.GetString()));
    }

    [Fact]
    public async Task LateInTheEvening_TodayHasNoHoursLeft()
    {
        var place = ScriptPlace();
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        var kayakingId = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Forecast late"));

        // 21:30 in Vilnius.
        var (status, body) = await PostAsync(
            new
            {
                setup = new { locationId = place.Id, dates = new[] { "2026-11-10" }, maxTravelDistanceKm = 30 },
                activities = new object[] { OutdoorActivity(kayakingId, minTemperatureC: 15) }
            },
            "2026-11-10T19:30:00Z");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(0, body.GetProperty("days")[0].GetProperty("hours").GetArrayLength());
        Assert.Equal(0, body.GetProperty("activities")[0].GetProperty("suitableHours").GetInt32());
        Assert.Equal(0, body.GetProperty("activities")[0].GetProperty("days")[0].GetProperty("periods").GetArrayLength());
    }

    [Fact]
    public async Task UnsuitableHours_GiveEveryReasonAndMissingValuesAreNull()
    {
        var place = ScriptPlace();
        var date = Today.AddDays(2);
        var forecast = FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20));
        forecast = FakeForecastClient.WithHour(forecast, date, 9, 15.0, 0.5, 8.0);
        forecast = FakeForecastClient.WithHour(forecast, date, 10, 4.2, 0.0, 3.0);
        forecast = FakeForecastClient.WithHour(forecast, date, 12, 16.4, 1.2, 9.0);
        forecast = FakeForecastClient.WithHour(forecast, date, 13, 35.0, 0.5, 8.0);
        forecast = FakeForecastClient.WithHour(forecast, date, 14, null, 0.0, 3.0);
        factory.Forecast.Script(place.Latitude, place.Longitude, forecast);
        var kayakingId = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Forecast reasons"));

        var (status, body) = await PostAsync(new
        {
            setup = new { locationId = place.Id, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
            activities = new object[] { OutdoorActivity(kayakingId, minTemperatureC: 15) }
        });

        Assert.Equal(HttpStatusCode.OK, status);
        var hours = body.GetProperty("activities")[0].GetProperty("days")[0].GetProperty("hours");

        // The hours start at 06:00, so the hour HH:00 is at position HH - 6.
        Assert.Equal(["Outside daylight"], Reasons(hours[7 - 6]));
        Assert.True(hours[9 - 6].GetProperty("suitable").GetBoolean());
        Assert.Equal(["Too cold: 4.2 °C, minimum 15.0 °C"], Reasons(hours[10 - 6]));
        Assert.Equal(
            ["Too much rain: 1.2 mm/h, maximum 0.5 mm/h", "Too windy: 9.0 m/s, maximum 8.0 m/s"],
            Reasons(hours[12 - 6]));
        Assert.True(hours[13 - 6].GetProperty("suitable").GetBoolean());
        Assert.Equal(["No forecast for this hour"], Reasons(hours[14 - 6]));

        var values = body.GetProperty("days")[0].GetProperty("hours")[14 - 6];
        Assert.Equal(JsonValueKind.Null, values.GetProperty("temperatureC").ValueKind);
        Assert.Equal(0.0m, values.GetProperty("rainMmPerHour").GetDecimal());
    }

    [Fact]
    public async Task OutOfDateSetup_GivesThePrefixedSetupKeys()
    {
        var place = ScriptPlace();
        var kayakingId = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Forecast past"));
        var calls = factory.Forecast.Calls;

        // The date was checked yesterday; it is now in the past.
        var (pastStatus, pastBody) = await PostAsync(
            new
            {
                setup = new { locationId = place.Id, dates = new[] { "2026-11-10" }, maxTravelDistanceKm = 30 },
                activities = new object[] { OutdoorActivity(kayakingId, minTemperatureC: 15) }
            },
            "2026-11-11T08:00:00Z");
        var (unknownStatus, unknownBody) = await PostAsync(new
        {
            setup = new { locationId = 1, dates = new[] { "2026-11-11" }, maxTravelDistanceKm = 30 },
            activities = new object[] { OutdoorActivity(kayakingId, minTemperatureC: 15) }
        });
        var (missingStatus, missingBody) = await PostAsync(new
        {
            activities = new object[] { OutdoorActivity(kayakingId, minTemperatureC: 15) }
        });

        Assert.Equal(HttpStatusCode.BadRequest, pastStatus);
        Assert.Equal(["setup.dates[0]"], ErrorKeys(pastBody));
        Assert.Equal("Dates cannot be in the past.", pastBody.GetProperty("errors").GetProperty("setup.dates[0]")[0].GetString());
        Assert.Equal(HttpStatusCode.BadRequest, unknownStatus);
        Assert.Equal(["setup.locationId"], ErrorKeys(unknownBody));
        Assert.Equal(HttpStatusCode.BadRequest, missingStatus);
        Assert.Equal(["setup"], ErrorKeys(missingBody));
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task OutOfDateActivities_GiveTheActivityKeys()
    {
        var place = ScriptPlace();
        var kayakingId = await AddOutdoorCategoryAsync(PostgreSqlApiFactory.UniqueCategoryName("Forecast stale"));
        var setup = new { locationId = place.Id, dates = new[] { "2026-11-11" }, maxTravelDistanceKm = 30 };
        var calls = factory.Forecast.Calls;
        var tooWindy = new
        {
            categoryId = kayakingId,
            type = "Outdoor",
            durationHours = 2,
            requiresDaylight = true,
            maxWindMs = 31,
            maxRainMmPerHour = 0.5,
            minTemperatureC = 15,
            maxTemperatureC = 35
        };

        var (windStatus, windBody) = await PostAsync(new { setup, activities = new object[] { tooWindy } });
        var (goneStatus, goneBody) = await PostAsync(new
        {
            setup,
            activities = new object[] { OutdoorActivity(Guid.NewGuid(), minTemperatureC: 15) }
        });
        var (emptyStatus, emptyBody) = await PostAsync(new { setup, activities = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.BadRequest, windStatus);
        Assert.Equal(["activities[0].maxWindMs"], ErrorKeys(windBody));
        Assert.Equal(HttpStatusCode.BadRequest, goneStatus);
        Assert.Equal(["activities[0]"], ErrorKeys(goneBody));
        Assert.Equal(HttpStatusCode.BadRequest, emptyStatus);
        Assert.Equal(["activities"], ErrorKeys(emptyBody));
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task UnreadableBody_GivesTheRequestKey()
    {
        var calls = factory.Forecast.Calls;
        using var client = factory.CreateHttpsClient();
        using var content = new StringContent(
            """{"setup":{"locationId":"one","dates":["2026-11-11"]},"activities":[]}""",
            Encoding.UTF8,
            "application/json");

        using var response = await client.PostAsync(Path, content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(["request"], ErrorKeys(document.RootElement));
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    private static List<string> ErrorKeys(JsonElement body) =>
        body.GetProperty("errors").EnumerateObject().Select(error => error.Name).ToList();

    private static List<string?> Reasons(JsonElement hour) =>
        hour.GetProperty("reasons").EnumerateArray().Select(reason => reason.GetString()).ToList();

    private static List<string> Keys(JsonElement element) =>
        element.EnumerateObject().Select(property => property.Name).ToList();

    private static object OutdoorActivity(Guid categoryId, double minTemperatureC) => new
    {
        categoryId,
        type = "Outdoor",
        durationHours = 2,
        requiresDaylight = true,
        maxWindMs = 8,
        maxRainMmPerHour = 0.5,
        minTemperatureC,
        maxTemperatureC = 35
    };

    private static object IndoorActivity(Guid categoryId) => new
    {
        categoryId,
        type = "Indoor",
        durationHours = 1.5,
        requiresDaylight = false,
        maxWindMs = (double?)null,
        maxRainMmPerHour = (double?)null,
        minTemperatureC = (double?)null,
        maxTemperatureC = (double?)null
    };

    /// <summary>A place in Lithuania with its own id and position, so no other test shares its cached forecast.</summary>
    private GeocodingPlace ScriptPlace()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 54.0 + (id % 100_000 / 1_000_000.0), 24.0, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        return place;
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

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(object body, string utcNow = Now)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(utcNow);
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, body);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (response.StatusCode, document.RootElement.Clone());
    }
}
