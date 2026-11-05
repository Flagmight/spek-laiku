using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SpekLaiku.Api;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// The plan setup request limit (spec FR-027, research section 14). Each test builds its own host with
/// a limit of 3 and its own fake geocoding service, so the shared host's high limit cannot hide a
/// mistake; the database is the collection's.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanSetupRateLimitTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task FourthRequest_IsRefusedWithTheContractAnswer()
    {
        var geocoding = new FakeGeocodingClient();
        await using var host = CreateHost(geocoding, permitLimit: "3");
        using var client = CreateClient(host);

        Assert.Equal(HttpStatusCode.OK, (await SearchAsync(client)).StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await CheckAsync(client)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SearchAsync(client)).StatusCode);
        using var refused = await SearchAsync(client);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        using var body = JsonDocument.Parse(await refused.Content.ReadAsStringAsync());
        Assert.Equal("Too many requests.", body.RootElement.GetProperty("title").GetString());
        Assert.Equal(
            "Too many requests. Wait a minute and try again.",
            body.RootElement.GetProperty("detail").GetString());
        Assert.True(refused.Headers.RetryAfter?.Delta > TimeSpan.Zero);
        Assert.Equal(2, geocoding.SearchCalls);
    }

    [Fact]
    public async Task CheckOverTheLimit_IsRefusedToo()
    {
        await using var host = CreateHost(new FakeGeocodingClient(), permitLimit: "3");
        using var client = CreateClient(host);
        for (var request = 0; request < 3; request++)
        {
            using var allowed = await SearchAsync(client);
        }

        using var refused = await CheckAsync(client);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
    }

    [Fact]
    public async Task VisitorAndSignedInUserFromOneAddress_ShareTheLimit()
    {
        await using var host = CreateHost(new FakeGeocodingClient(), permitLimit: "3");
        using var visitor = CreateClient(host);
        var user = await factory.CreateUserAsync();
        using var signedIn = CreateClient(host);
        using var signIn = await signedIn.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(user.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);

        using var first = await SearchAsync(visitor);
        using var second = await SearchAsync(signedIn);
        using var third = await SearchAsync(visitor);
        using var refused = await SearchAsync(signedIn);

        Assert.Equal(HttpStatusCode.OK, third.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
    }

    [Fact]
    public async Task LimitOfZero_StopsTheApplicationFromStarting()
    {
        await using var host = CreateHost(new FakeGeocodingClient(), permitLimit: "0");

        var exception = Record.Exception(() => host.CreateClient());

        Assert.NotNull(exception);
        Assert.Contains("must be positive", Describe(exception));
    }

    private WebApplicationFactory<Program> CreateHost(FakeGeocodingClient geocoding, string permitLimit) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("RateLimiting:PlanSetup:PermitLimit", permitLimit);
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IGeocodingClient>();
                services.AddSingleton<IGeocodingClient>(geocoding);
            });
        });

    private static HttpClient CreateClient(WebApplicationFactory<Program> host) =>
        host.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });

    private static Task<HttpResponseMessage> SearchAsync(HttpClient client) =>
        client.GetAsync($"/api/locations?query=Limit{Guid.NewGuid():N}");

    private static Task<HttpResponseMessage> CheckAsync(HttpClient client) =>
        client.PostAsJsonAsync("/api/plan-setup/check", new { locationId = 1, dates = new[] { "2026-11-07" } });

    // The validation message may be wrapped by the host, so every inner exception is read.
    private static string Describe(Exception exception)
    {
        var messages = new List<string>();
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            messages.Add(current.Message);
            if (current is AggregateException aggregate)
            {
                messages.AddRange(aggregate.InnerExceptions.Select(inner => inner.Message));
            }
        }

        return string.Join(" | ", messages);
    }
}
