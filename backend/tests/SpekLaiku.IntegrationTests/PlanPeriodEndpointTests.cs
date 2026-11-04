using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>GET /api/plan-setup/period</c>: the date limits the page uses, worked out only by the server
/// (spec FR-010, contracts/plan-setup-api.md). Each test sets the forecast period's clock.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanPeriodEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-setup/period";

    [Theory]
    [InlineData("2026-11-04T21:59:59Z", "2026-11-04", "2026-11-10")]
    [InlineData("2026-11-04T22:00:00Z", "2026-11-05", "2026-11-11")]
    public async Task Visitor_GetsTodayInLithuaniaPlusSixDaysAndTheDateLimit(
        string utcNow,
        string firstDate,
        string lastDate)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(utcNow);
        using var client = factory.CreateHttpsClient();

        using var response = await client.GetAsync(Path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync(response);
        Assert.Equal(firstDate, body.GetProperty("firstDate").GetString());
        Assert.Equal(lastDate, body.GetProperty("lastDate").GetString());
        Assert.Equal(7, body.GetProperty("maxDates").GetInt32());
    }

    [Fact]
    public async Task ActiveRegisteredUser_GetsThePeriod()
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse("2026-11-04T10:00:00Z");
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await client.GetAsync(Path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("2026-11-04", (await ReadJsonAsync(response)).GetProperty("firstDate").GetString());
    }

    [Fact]
    public async Task ManyRequests_AreNeverRateLimited()
    {
        // Its own host with a limit of 1, so the shared host's high limit does not hide a mistake.
        await using var lowLimit = factory.WithWebHostBuilder(builder =>
            builder.UseSetting("RateLimiting:PlanSetup:PermitLimit", "1"));
        using var client = lowLimit.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        for (var request = 0; request < 3; request++)
        {
            using var response = await client.GetAsync(Path);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        using var search = await client.GetAsync($"/api/locations?query=Limit{Guid.NewGuid():N}");
        using var refused = await client.GetAsync($"/api/locations?query=Limit{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.OK, search.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }
}
