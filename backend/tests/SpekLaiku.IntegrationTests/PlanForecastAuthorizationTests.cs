using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Only Visitors and Active Registered Users may get the forecast (contracts/plan-forecast-api.md
/// authorization table, spec FR-002). A refused caller reaches neither the location search nor the weather
/// service.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanForecastAuthorizationTests(PostgreSqlApiFactory factory)
{
    public static TheoryData<string, string> RefusedCallers => new()
    {
        { "Registered User", nameof(AccountStatus.Suspended) },
        { "Administrator", nameof(AccountStatus.Active) },
        { "Administrator", nameof(AccountStatus.Suspended) }
    };

    [Fact]
    public async Task Visitor_IsAllowed()
    {
        using var client = factory.CreateHttpsClient();

        using var response = await SendAsync(client, ScriptPlace());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ActiveRegisteredUser_IsAllowed()
    {
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await SendAsync(client, ScriptPlace());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(RefusedCallers))]
    public async Task OtherSignedInAccount_Gets403WithoutReachingTheServices(string role, string status)
    {
        using var client = await factory.CreateSignedInClientAsync(role, Enum.Parse<AccountStatus>(status));
        var place = ScriptPlace();
        var lookups = factory.Geocoding.GetCalls;
        var forecasts = factory.Forecast.Calls;

        using var response = await SendAsync(client, place);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("updatedAt", body);
        Assert.DoesNotContain("suitableHours", body);
        Assert.Equal(lookups, factory.Geocoding.GetCalls);
        Assert.Equal(forecasts, factory.Forecast.Calls);
    }

    [Fact]
    public async Task AccountDeletedAfterSignIn_Gets403WithoutReachingTheServices()
    {
        var user = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        using (var signIn = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(user.Email!)}", content: null))
        {
            Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var stored = await userManager.FindByIdAsync(user.Id);
            Assert.True((await userManager.DeleteAsync(stored!)).Succeeded);
        }

        var place = ScriptPlace();
        var lookups = factory.Geocoding.GetCalls;
        var forecasts = factory.Forecast.Calls;

        using var response = await SendAsync(client, place);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(lookups, factory.Geocoding.GetCalls);
        Assert.Equal(forecasts, factory.Forecast.Calls);
    }

    /// <summary>A place with its own id and position, and a forecast for it, so an allowed caller gets 200.</summary>
    private GeocodingPlace ScriptPlace()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 55.5 + (id % 100_000 / 1_000_000.0), 23.5, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(new DateOnly(2026, 11, 10), 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        return place;
    }

    // A valid request with the always-stored starter Museum category, at 14:20 on 2026-11-10 in Vilnius.
    private Task<HttpResponseMessage> SendAsync(HttpClient client, GeocodingPlace place)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse("2026-11-10T12:20:00Z");
        return client.PostAsJsonAsync("/api/plan-forecast", new
        {
            setup = new { locationId = place.Id, dates = new[] { "2026-11-11" }, maxTravelDistanceKm = 30 },
            activities = new[]
            {
                new
                {
                    categoryId = StarterCategories.MuseumId,
                    type = "Indoor",
                    durationHours = 2,
                    requiresDaylight = false
                }
            }
        });
    }
}
