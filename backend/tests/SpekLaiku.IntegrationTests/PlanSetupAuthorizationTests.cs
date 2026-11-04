using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Only Visitors and Active Registered Users may use the plan setup endpoints (contracts/plan-setup-api.md
/// authorization table, spec FR-003). A refused request never reaches the location search service.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanSetupAuthorizationTests(PostgreSqlApiFactory factory)
{
    public static TheoryData<string> Endpoints => ["search", "period", "check"];

    public static TheoryData<string, string, string> RefusedCallers
    {
        get
        {
            var data = new TheoryData<string, string, string>();
            foreach (var endpoint in Endpoints)
            {
                data.Add(endpoint, "Registered User", nameof(AccountStatus.Suspended));
                data.Add(endpoint, "Administrator", nameof(AccountStatus.Active));
                data.Add(endpoint, "Administrator", nameof(AccountStatus.Suspended));
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task Visitor_IsAllowed(string endpoint)
    {
        using var client = factory.CreateHttpsClient();

        using var response = await SendAsync(client, endpoint);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task ActiveRegisteredUser_IsAllowed(string endpoint)
    {
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await SendAsync(client, endpoint);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(RefusedCallers))]
    public async Task OtherSignedInAccount_Gets403AndTheServiceIsNotCalled(string endpoint, string role, string status)
    {
        using var client = await factory.CreateSignedInClientAsync(role, Enum.Parse<AccountStatus>(status));
        var calls = factory.Geocoding.SearchCalls + factory.Geocoding.GetCalls;

        using var response = await SendAsync(client, endpoint);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Testinė", body);
        Assert.DoesNotContain("firstDate", body);
        Assert.Equal(calls, factory.Geocoding.SearchCalls + factory.Geocoding.GetCalls);
    }

    [Fact]
    public async Task AccountDeletedAfterSignIn_Gets403()
    {
        var (user, client) = await SignInAsync();
        using (client)
        {
            await ChangeAccountAsync(user, (userManager, stored) => userManager.DeleteAsync(stored));

            using var response = await SendAsync(client, "search");

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }

    [Fact]
    public async Task RegisteredUserSuspendedAfterSignIn_Gets403OnTheNextRequest()
    {
        var (user, client) = await SignInAsync();
        using (client)
        {
            using (var allowed = await SendAsync(client, "period"))
            {
                Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
            }

            await ChangeAccountAsync(user, (userManager, stored) =>
            {
                stored.AccountStatus = AccountStatus.Suspended;
                return userManager.UpdateAsync(stored);
            });

            using var response = await SendAsync(client, "period");

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }

    private async Task<(ApplicationUser User, HttpClient Client)> SignInAsync()
    {
        var user = await factory.CreateUserAsync();
        var client = factory.CreateHttpsClient();
        using var signIn = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(user.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
        return (user, client);
    }

    private async Task ChangeAccountAsync(
        ApplicationUser user,
        Func<UserManager<ApplicationUser>, ApplicationUser, Task<IdentityResult>> change)
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var stored = await userManager.FindByIdAsync(user.Id);
        Assert.True((await change(userManager, stored!)).Succeeded);
    }

    // A valid request for each endpoint, with its own search text and place id, so an allowed caller
    // gets 200 and a refused one shows whether the service was asked.
    private Task<HttpResponseMessage> SendAsync(HttpClient client, string endpoint)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse("2026-11-04T10:00:00Z");
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 54.9, 23.9, "LT", "Kaunas", null);
        var text = $"Auth{Guid.NewGuid():N}";
        factory.Geocoding.Script(text, place);
        factory.Geocoding.ScriptPlace(place);

        return endpoint switch
        {
            "search" => client.GetAsync($"/api/locations?query={text}"),
            "period" => client.GetAsync("/api/plan-setup/period"),
            "check" => client.PostAsJsonAsync(
                "/api/plan-setup/check",
                new { locationId = id, dates = new[] { "2026-11-07" } }),
            _ => throw new ArgumentOutOfRangeException(nameof(endpoint))
        };
    }
}
