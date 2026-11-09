using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Only Visitors and Active Registered Users may use the plan activity endpoints
/// (contracts/plan-activities-api.md authorization table, spec FR-002).
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanActivitiesAuthorizationTests(PostgreSqlApiFactory factory)
{
    public static TheoryData<string> Endpoints => ["categories", "check"];

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
    public async Task OtherSignedInAccount_Gets403AndNoPlanData(string endpoint, string role, string status)
    {
        using var client = await factory.CreateSignedInClientAsync(role, Enum.Parse<AccountStatus>(status));

        using var response = await SendAsync(client, endpoint);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("maxActivities", body);
        Assert.DoesNotContain("durationHours", body);
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task AccountDeletedAfterSignIn_Gets403(string endpoint)
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

        using var response = await SendAsync(client, endpoint);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // A valid request for each endpoint, so an allowed caller gets 200. The starter category is always stored.
    private static Task<HttpResponseMessage> SendAsync(HttpClient client, string endpoint) => endpoint switch
    {
        "categories" => client.GetAsync("/api/plan-activities/categories"),
        "check" => client.PostAsJsonAsync(
            "/api/plan-activities/check",
            new
            {
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
            }),
        _ => throw new ArgumentOutOfRangeException(nameof(endpoint))
    };
}
