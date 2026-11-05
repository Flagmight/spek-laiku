using System.Net;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.UnitTests;

/// <summary>The Open-Meteo geocoding client, against fake responses shaped like the real ones (research section 1).</summary>
public sealed class OpenMeteoGeocodingClientTests : IDisposable
{
    private const string SearchSample = """
        {"results":[
          {"id":598316,"name":"Kaunas","latitude":54.90156,"longitude":23.90909,"elevation":96.0,"feature_code":"PPLA",
           "country_code":"LT","admin1_id":864477,"admin2_id":598318,"timezone":"Europe/Vilnius","population":289380,
           "country_id":597427,"country":"Lithuania","admin1":"Kaunas","admin2":"Kaunas"},
          {"id":11301040,"name":"Kauniai","latitude":56.19924,"longitude":24.69617,"elevation":49.0,"feature_code":"PPL",
           "country_code":"LT","admin1_id":864480,"admin2_id":864499,"admin3_id":12232841,"timezone":"Europe/Vilnius",
           "country_id":597427,"country":"Lithuania","admin1":"Panevėžys","admin2":"Biržai District Municipality",
           "admin3":"Širvėnos sen."}
        ],"generationtime_ms":0.33}
        """;

    private const string KaunasSample = """
        {"id":598316,"name":"Kaunas","latitude":54.90156,"longitude":23.90909,"country_code":"LT",
         "admin1":"Kaunas","admin2":"Kaunas"}
        """;

    private const string SecretSearchText = "Secret-street-42";

    private readonly CapturingLoggerProvider logs = new();
    private readonly ILoggerFactory loggerFactory;

    public OpenMeteoGeocodingClientTests()
    {
        loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(logs));
    }

    [Theory]
    [InlineData("Šiauliai", "name=%C5%A0iauliai")]
    [InlineData("a&b", "name=a%26b")]
    public async Task SearchAsync_EscapesTextAndAsksForLithuanianPlacesInEnglish(string text, string expectedName)
    {
        var handler = FakeHttpMessageHandler.Json("""{"generationtime_ms":0.06}""");

        await CreateClient(handler).SearchAsync(text, CancellationToken.None);

        var uri = Assert.Single(handler.RequestedUris);
        Assert.Equal("/v1/search", uri.AbsolutePath);
        Assert.Contains(expectedName, uri.Query);
        Assert.Contains("count=10", uri.Query);
        Assert.Contains("language=en", uri.Query);
        Assert.Contains("countryCode=LT", uri.Query);
    }

    [Fact]
    public async Task SearchAsync_ReadsEveryPlaceWithItsAdminAreas()
    {
        var places = await CreateClient(FakeHttpMessageHandler.Json(SearchSample))
            .SearchAsync("Kaun", CancellationToken.None);

        Assert.Equal(
            [
                new GeocodingPlace(598316, "Kaunas", 54.90156, 23.90909, "LT", "Kaunas", "Kaunas"),
                new GeocodingPlace(
                    11301040, "Kauniai", 56.19924, 24.69617, "LT", "Panevėžys", "Biržai District Municipality")
            ],
            places);
    }

    [Fact]
    public async Task SearchAsync_WithoutResults_ReturnsEmptyList()
    {
        var places = await CreateClient(FakeHttpMessageHandler.Json("""{"generationtime_ms":0.06}"""))
            .SearchAsync("zzqxw", CancellationToken.None);

        Assert.Empty(places);
    }

    [Fact]
    public async Task SearchAsync_SkipsPlaceWithoutCountryCode()
    {
        const string body = """
            {"results":[
              {"id":1,"name":"Nowhere","latitude":1.0,"longitude":2.0},
              {"id":2,"name":"Alytus","latitude":54.4,"longitude":24.05,"country_code":"LT","admin1":"Alytus"}
            ]}
            """;

        var places = await CreateClient(FakeHttpMessageHandler.Json(body)).SearchAsync("Al", CancellationToken.None);

        var place = Assert.Single(places);
        Assert.Equal(2, place.Id);
        Assert.Null(place.Admin2);
    }

    [Fact]
    public async Task GetAsync_ReadsTheBarePlaceObject()
    {
        var handler = FakeHttpMessageHandler.Json(KaunasSample);

        var place = await CreateClient(handler).GetAsync(598316, CancellationToken.None);

        Assert.Equal(new GeocodingPlace(598316, "Kaunas", 54.90156, 23.90909, "LT", "Kaunas", "Kaunas"), place);
        var uri = Assert.Single(handler.RequestedUris);
        Assert.Equal("/v1/get", uri.AbsolutePath);
        Assert.Contains("id=598316", uri.Query);
        Assert.Contains("language=en", uri.Query);
    }

    [Fact]
    public async Task GetAsync_UnknownId_ReturnsNull()
    {
        var handler = FakeHttpMessageHandler.Json(
            """{"error":true,"reason":"Location ID not found."}""", HttpStatusCode.BadRequest);

        Assert.Null(await CreateClient(handler).GetAsync(1, CancellationToken.None));
        Assert.Empty(logs.Entries);
    }

    [Fact]
    public async Task ServerError_ThrowsUnexpectedStatus()
    {
        var handler = FakeHttpMessageHandler.Json("{}", HttpStatusCode.InternalServerError);

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(
            () => CreateClient(handler).SearchAsync(SecretSearchText, CancellationToken.None));

        Assert.Equal(FailureKind.UnexpectedStatus, exception.Kind);
        Assert.Equal(500, exception.StatusCode);
        Assert.Equal(ExternalService.LocationSearch, exception.Service);
        AssertOneWarningWithoutSearchText("UnexpectedStatus");
    }

    [Fact]
    public async Task BadRequestOnSearch_ThrowsUnexpectedStatus()
    {
        var handler = FakeHttpMessageHandler.Json("""{"error":true}""", HttpStatusCode.BadRequest);

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(
            () => CreateClient(handler).SearchAsync(SecretSearchText, CancellationToken.None));

        Assert.Equal(FailureKind.UnexpectedStatus, exception.Kind);
    }

    [Fact]
    public async Task NetworkError_ThrowsNetwork()
    {
        var handler = FakeHttpMessageHandler.Throws(new HttpRequestException("No such host is known."));

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(
            () => CreateClient(handler).SearchAsync(SecretSearchText, CancellationToken.None));

        Assert.Equal(FailureKind.Network, exception.Kind);
        AssertOneWarningWithoutSearchText("Network");
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
            () => CreateClient(handler, TimeSpan.FromMilliseconds(50)).SearchAsync(SecretSearchText, CancellationToken.None));

        Assert.Equal(FailureKind.Timeout, exception.Kind);
        AssertOneWarningWithoutSearchText("Timeout");
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("null")]
    public async Task UnreadableBody_ThrowsInvalidResponse(string body)
    {
        var exception = await Assert.ThrowsAsync<ExternalServiceException>(
            () => CreateClient(FakeHttpMessageHandler.Json(body)).SearchAsync(SecretSearchText, CancellationToken.None));

        Assert.Equal(FailureKind.InvalidResponse, exception.Kind);
        AssertOneWarningWithoutSearchText("InvalidResponse");
    }

    [Fact]
    public async Task GetAsync_PlaceWithoutRequiredFields_ThrowsInvalidResponse()
    {
        var exception = await Assert.ThrowsAsync<ExternalServiceException>(
            () => CreateClient(FakeHttpMessageHandler.Json("""{"id":1}""")).GetAsync(1, CancellationToken.None));

        Assert.Equal(FailureKind.InvalidResponse, exception.Kind);
    }

    [Fact]
    public async Task CallerCancellation_IsNotAServiceFailure()
    {
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();
        var handler = new FakeHttpMessageHandler(async (_, token) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(10), token);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => CreateClient(handler).SearchAsync("Kaunas", cancellation.Token));
        Assert.Empty(logs.Entries);
    }

    public void Dispose()
    {
        loggerFactory.Dispose();
        logs.Dispose();
    }

    private OpenMeteoGeocodingClient CreateClient(HttpMessageHandler handler, TimeSpan? timeout = null) =>
        new(
            new HttpClient(handler)
            {
                BaseAddress = OpenMeteoGeocodingClient.BaseAddress,
                Timeout = timeout ?? OpenMeteoGeocodingClient.Timeout
            },
            loggerFactory.CreateLogger<OpenMeteoGeocodingClient>());

    private void AssertOneWarningWithoutSearchText(string kind)
    {
        var entry = Assert.Single(logs.Entries);
        Assert.Contains("Warning", entry);
        Assert.Contains(kind, entry);
        Assert.DoesNotContain(SecretSearchText, entry);
    }
}
