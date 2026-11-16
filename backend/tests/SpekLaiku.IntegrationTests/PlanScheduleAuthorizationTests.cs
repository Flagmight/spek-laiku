using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Only Visitors and Active Registered Users may generate a schedule (contracts/plan-schedule-api.md
/// authorization table, spec FR-001, FR-002). A refused caller reaches neither the weather service nor the
/// map data service.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanScheduleAuthorizationTests(PostgreSqlApiFactory factory)
{
    private static readonly DateOnly Today = new(2026, 11, 10);

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

        using var response = await SendAsync(client, ScriptPlaceWithForecastAndPlaces());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("scheduled", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ActiveRegisteredUser_IsAllowed()
    {
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await SendAsync(client, ScriptPlaceWithForecastAndPlaces());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(RefusedCallers))]
    public async Task OtherSignedInAccount_Gets403WithoutReachingTheServices(string role, string status)
    {
        using var client = await factory.CreateSignedInClientAsync(role, Enum.Parse<AccountStatus>(status));
        var place = ScriptPlaceWithForecastAndPlaces();
        var forecastCalls = factory.Forecast.Calls;
        var mapCalls = factory.MapPlaces.Calls;

        using var response = await SendAsync(client, place);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("scheduled", body);
        Assert.Equal(forecastCalls, factory.Forecast.Calls);
        Assert.Equal(mapCalls, factory.MapPlaces.Calls);
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

        var place = ScriptPlaceWithForecastAndPlaces();
        var forecastCalls = factory.Forecast.Calls;
        var mapCalls = factory.MapPlaces.Calls;

        using var response = await SendAsync(client, place);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(forecastCalls, factory.Forecast.Calls);
        Assert.Equal(mapCalls, factory.MapPlaces.Calls);
    }

    /// <summary>A place with forecast and places scripted, so an allowed caller gets 200.</summary>
    private GeocodingPlace ScriptPlaceWithForecastAndPlaces()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 55.5 + (id % 100_000 / 1_000_000.0), 24.5, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        factory.MapPlaces.Script(
            place.Latitude,
            place.Longitude,
            [FakeMapPlacesClient.Element("node/1", place.Latitude, place.Longitude, ("name", "Muziejus"), ("tourism", "museum"))]);
        return place;
    }

    // A valid request with the always-stored starter Museum category, at 14:20 on 2026-11-10 in Vilnius.
    private Task<HttpResponseMessage> SendAsync(HttpClient client, GeocodingPlace place)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse("2026-11-10T12:20:00Z");
        return client.PostAsJsonAsync("/api/plan-schedule", new
        {
            setup = new { locationId = place.Id, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
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
