using System.Globalization;
using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The Open-Meteo forecast client, against fake answers shaped like the real ones with
/// <c>timeformat=unixtime</c> (research sections 1 and 11).
/// </summary>
public sealed class OpenMeteoForecastClientTests : IDisposable
{
    private const double Latitude = 54.6872;
    private const double Longitude = 25.2797;

    private static readonly DateOnly FirstDate = new(2026, 11, 10);
    private static readonly DateOnly SecondDate = new(2026, 11, 11);
    private static readonly TimeZoneInfo Lithuania = TimeZoneInfo.FindSystemTimeZoneById("Europe/Vilnius");

    private readonly CapturingLoggerProvider logs = new();
    private readonly ILoggerFactory loggerFactory;

    public OpenMeteoForecastClientTests()
    {
        loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(logs));
    }

    [Fact]
    public async Task GetAsync_AsksForTheHourlyValuesDaylightAndUnitsOfThePeriodInvariantly()
    {
        var handler = FakeHttpMessageHandler.Json(Answer(FirstDate, 7).ToJsonString());
        var culture = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("lt-LT");
        try
        {
            await CreateClient(handler).GetAsync(Latitude, Longitude, FirstDate, FirstDate.AddDays(6), CancellationToken.None);
        }
        finally
        {
            CultureInfo.CurrentCulture = culture;
        }

        var uri = Assert.Single(handler.RequestedUris);
        Assert.Equal("/v1/forecast", uri.AbsolutePath);
        Assert.Equal(
            "?latitude=54.6872&longitude=25.2797&hourly=temperature_2m,precipitation,wind_speed_10m"
            + "&daily=sunrise,sunset&wind_speed_unit=ms&timezone=Europe%2FVilnius&timeformat=unixtime"
            + "&start_date=2026-11-10&end_date=2026-11-16",
            uri.Query);
    }

    [Fact]
    public async Task GetAsync_ReadsEveryHourAtItsInstantAndEveryDayAsALithuanianDate()
    {
        var forecast = await GetAsync(Answer(FirstDate, 2));

        Assert.Equal(48, forecast.Hours.Count);
        // Midnight in Vilnius in winter is 22:00 UTC the day before.
        Assert.Equal(DateTimeOffset.Parse("2026-11-09T22:00:00Z", CultureInfo.InvariantCulture), forecast.Hours[0].Time);
        Assert.Equal(DateTimeOffset.Parse("2026-11-10T09:00:00Z", CultureInfo.InvariantCulture), forecast.Hours[11].Time);
        Assert.Equal(new ForecastHourValues(forecast.Hours[11].Time, 5.5, 0.2, 3.4), forecast.Hours[11]);
        Assert.Equal([FirstDate, SecondDate], forecast.Days.Select(day => day.Date));
        Assert.Equal(LocalInstant(FirstDate, 7, 42), forecast.Days[0].Sunrise);
        Assert.Equal(LocalInstant(SecondDate, 16, 20), forecast.Days[1].Sunset);
    }

    [Fact]
    public async Task GetAsync_KeepsMissingHourlyValuesAsNull()
    {
        var answer = Answer(FirstDate, 2);
        answer["hourly"]!["temperature_2m"]![3] = null;
        answer["hourly"]!["precipitation"]![4] = null;
        answer["hourly"]!["wind_speed_10m"]![5] = null;

        var forecast = await GetAsync(answer);

        Assert.Null(forecast.Hours[3].TemperatureC);
        Assert.Null(forecast.Hours[4].PrecipitationMm);
        Assert.Null(forecast.Hours[5].WindSpeedMs);
        Assert.Equal(5.5, forecast.Hours[4].TemperatureC);
    }

    public static TheoryData<string> IncompleteAnswers => new()
    {
        "hourly array shorter than its times",
        "no hourly block",
        "no daily block",
        "no sunrise for a requested date",
        "no sunset array",
        "a requested date missing"
    };

    [Theory]
    [MemberData(nameof(IncompleteAnswers))]
    public async Task IncompleteAnswer_ThrowsInvalidResponse(string problem)
    {
        var answer = Answer(FirstDate, 2);
        switch (problem)
        {
            case "hourly array shorter than its times":
                answer["hourly"]!["wind_speed_10m"]!.AsArray().RemoveAt(0);
                break;
            case "no hourly block":
                answer.Remove("hourly");
                break;
            case "no daily block":
                answer.Remove("daily");
                break;
            case "no sunrise for a requested date":
                answer["daily"]!["sunrise"]![1] = null;
                break;
            case "no sunset array":
                answer["daily"]!.AsObject().Remove("sunset");
                break;
            case "a requested date missing":
                answer = Answer(FirstDate, 1);
                break;
        }

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(() => GetAsync(answer));

        Assert.Equal(FailureKind.InvalidResponse, exception.Kind);
        Assert.Equal(ExternalService.Forecast, exception.Service);
        AssertOneWarningWithoutPositionOrDates("InvalidResponse");
    }

    [Fact]
    public async Task ServerError_ThrowsUnexpectedStatus()
    {
        var handler = FakeHttpMessageHandler.Json("{}", HttpStatusCode.InternalServerError);

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(() => GetAsync(handler));

        Assert.Equal(FailureKind.UnexpectedStatus, exception.Kind);
        Assert.Equal(500, exception.StatusCode);
        Assert.Equal(ExternalService.Forecast, exception.Service);
        AssertOneWarningWithoutPositionOrDates("UnexpectedStatus");
    }

    [Fact]
    public async Task NetworkError_ThrowsNetwork()
    {
        var handler = FakeHttpMessageHandler.Throws(new HttpRequestException("No such host is known."));

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(() => GetAsync(handler));

        Assert.Equal(FailureKind.Network, exception.Kind);
        Assert.Equal(ExternalService.Forecast, exception.Service);
        AssertOneWarningWithoutPositionOrDates("Network");
    }

    [Fact]
    public async Task NoAnswerWithinTimeout_ThrowsTimeout()
    {
        var handler = new FakeHttpMessageHandler(async (_, token) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(10), token);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(
            () => CreateClient(handler, TimeSpan.FromMilliseconds(50))
                .GetAsync(Latitude, Longitude, FirstDate, SecondDate, CancellationToken.None));

        Assert.Equal(FailureKind.Timeout, exception.Kind);
        Assert.Equal(ExternalService.Forecast, exception.Service);
        AssertOneWarningWithoutPositionOrDates("Timeout");
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("null")]
    [InlineData("""{"hourly":{"time":[null]}}""")]
    public async Task UnreadableBody_ThrowsInvalidResponse(string body)
    {
        var exception = await Assert.ThrowsAsync<ExternalServiceException>(
            () => GetAsync(FakeHttpMessageHandler.Json(body)));

        Assert.Equal(FailureKind.InvalidResponse, exception.Kind);
        Assert.Equal(ExternalService.Forecast, exception.Service);
        AssertOneWarningWithoutPositionOrDates("InvalidResponse");
    }

    public void Dispose()
    {
        loggerFactory.Dispose();
        logs.Dispose();
    }

    /// <summary>
    /// A full answer for <paramref name="days"/> days from <paramref name="firstDate"/>: 24 hours a day from
    /// local midnight with 5.5 °C, 0.2 mm and 3.4 m/s, sunrise 07:42 and sunset 16:20.
    /// </summary>
    private static JsonObject Answer(DateOnly firstDate, int days)
    {
        var hourTimes = new JsonArray();
        var temperatures = new JsonArray();
        var precipitation = new JsonArray();
        var wind = new JsonArray();
        var dayTimes = new JsonArray();
        var sunrises = new JsonArray();
        var sunsets = new JsonArray();
        for (var day = 0; day < days; day++)
        {
            var date = firstDate.AddDays(day);
            var midnight = LocalInstant(date, 0, 0).ToUnixTimeSeconds();
            dayTimes.Add(midnight);
            sunrises.Add(LocalInstant(date, 7, 42).ToUnixTimeSeconds());
            sunsets.Add(LocalInstant(date, 16, 20).ToUnixTimeSeconds());
            for (var hour = 0; hour < 24; hour++)
            {
                hourTimes.Add(midnight + (hour * 3600));
                temperatures.Add(5.5);
                precipitation.Add(0.2);
                wind.Add(3.4);
            }
        }

        return new JsonObject
        {
            ["latitude"] = Latitude,
            ["longitude"] = Longitude,
            ["timezone"] = "Europe/Vilnius",
            ["hourly"] = new JsonObject
            {
                ["time"] = hourTimes,
                ["temperature_2m"] = temperatures,
                ["precipitation"] = precipitation,
                ["wind_speed_10m"] = wind
            },
            ["daily"] = new JsonObject { ["time"] = dayTimes, ["sunrise"] = sunrises, ["sunset"] = sunsets }
        };
    }

    private static DateTimeOffset LocalInstant(DateOnly date, int hour, int minute)
    {
        var local = date.ToDateTime(new TimeOnly(hour, minute));
        return new DateTimeOffset(local, Lithuania.GetUtcOffset(local));
    }

    private Task<HourlyForecast> GetAsync(JsonObject answer) =>
        GetAsync(FakeHttpMessageHandler.Json(answer.ToJsonString()));

    private Task<HourlyForecast> GetAsync(FakeHttpMessageHandler handler) =>
        CreateClient(handler).GetAsync(Latitude, Longitude, FirstDate, SecondDate, CancellationToken.None);

    private OpenMeteoForecastClient CreateClient(HttpMessageHandler handler, TimeSpan? timeout = null) =>
        new(
            new HttpClient(handler)
            {
                BaseAddress = OpenMeteoForecastClient.BaseAddress,
                Timeout = timeout ?? OpenMeteoForecastClient.Timeout
            },
            loggerFactory.CreateLogger<OpenMeteoForecastClient>());

    private void AssertOneWarningWithoutPositionOrDates(string kind)
    {
        var entry = Assert.Single(logs.Entries);
        Assert.Contains("Warning", entry);
        Assert.Contains("Forecast service failed", entry);
        Assert.Contains(kind, entry);
        Assert.DoesNotContain("54.6872", entry);
        Assert.DoesNotContain("54,6872", entry);
        Assert.DoesNotContain("25.2797", entry);
        Assert.DoesNotContain("2026-11-1", entry);
    }
}
