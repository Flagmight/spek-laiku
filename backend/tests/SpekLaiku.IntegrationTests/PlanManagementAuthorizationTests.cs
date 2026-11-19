using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Only the owner can delete, duplicate, rename or replace a saved plan (feature 011 spec FR-015, FR-016,
/// User Story 5, SC-005; contracts/plans-api.md; constitution III). Visitors get 401, Administrators and Suspended
/// users 403, and another user gets 403 with no plan data, while the owner's plan stays unchanged, uncopied and
/// undeleted.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanManagementAuthorizationTests(PostgreSqlApiFactory factory)
{
    private const string PlanName = "Owner's weekend";

    private static readonly string[] EndpointNames = ["delete", "duplicate", "rename", "replace"];

    private readonly ScheduleScenario scenario = new(factory);

    public static TheoryData<string> Endpoints => new(EndpointNames);

    public static TheoryData<string, string, string> RefusedAccounts
    {
        get
        {
            var data = new TheoryData<string, string, string>();
            foreach (var endpoint in EndpointNames)
            {
                data.Add(endpoint, "Administrator", nameof(AccountStatus.Active));
                data.Add(endpoint, "Administrator", nameof(AccountStatus.Suspended));
                data.Add(endpoint, "Registered User", nameof(AccountStatus.Suspended));
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task Visitor_Gets401AndThePlanIsUnchanged(string endpoint)
    {
        var owned = await CreateOwnedPlanAsync();
        using var client = factory.CreateHttpsClient();
        var scheduleId = await scenario.GenerateIdAsync(client);

        using var response = await SendAsync(client, endpoint, owned.PlanId, scheduleId);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync());
        await AssertUnchangedAsync(owned);
    }

    [Theory]
    [MemberData(nameof(RefusedAccounts))]
    public async Task AdministratorOrSuspendedUser_Gets403WithoutPlanData(string endpoint, string role, string status)
    {
        var owned = await CreateOwnedPlanAsync();
        using var client = await factory.CreateSignedInClientAsync(role, Enum.Parse<AccountStatus>(status));
        using var visitor = factory.CreateHttpsClient();
        var scheduleId = await scenario.GenerateIdAsync(visitor);

        using var response = await SendAsync(client, endpoint, owned.PlanId, scheduleId);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertNoPlanDataAsync(response, owned.PlanId);
        await AssertUnchangedAsync(owned);
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task AnotherUser_Gets403WithoutPlanDataAndNothingChanges(string endpoint)
    {
        var owned = await CreateOwnedPlanAsync();
        var other = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        await SignInAsync(client, other);
        var scheduleId = await scenario.GenerateIdAsync(client);

        using var response = await SendAsync(client, endpoint, owned.PlanId, scheduleId);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertNoPlanDataAsync(response, owned.PlanId);
        await AssertUnchangedAsync(owned);
        Assert.Equal(0, await CountPlansOfAsync(other.Id));
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task AnUnknownPlan_Gets404AndNothingIsCreated(string endpoint)
    {
        var owned = await CreateOwnedPlanAsync();
        var scheduleId = await scenario.GenerateIdAsync(owned.Client);

        using var response = await SendAsync(owned.Client, endpoint, Guid.NewGuid(), scheduleId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("This plan no longer exists.", document.RootElement.GetProperty("detail").GetString());
        await AssertUnchangedAsync(owned);
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task AnIdThatIsNotAGuid_Gets404(string endpoint)
    {
        var owned = await CreateOwnedPlanAsync();
        var scheduleId = await scenario.GenerateIdAsync(owned.Client);

        using var response = await SendAsync(owned.Client, endpoint, "not-a-plan", scheduleId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await AssertUnchangedAsync(owned);
    }

    private sealed record OwnedPlan(HttpClient Client, string OwnerId, Guid PlanId, Stored Before);

    private sealed record Stored(string Name, DateTime SavedAtUtc, Guid? GeneratedScheduleId, string Snapshot);

    private async Task<OwnedPlan> CreateOwnedPlanAsync()
    {
        var owner = await factory.CreateUserAsync();
        var client = factory.CreateHttpsClient();
        await SignInAsync(client, owner);
        var scheduleId = await scenario.GenerateIdAsync(client);
        using var response = await client.PostAsJsonAsync(
            "/api/plans",
            new { generatedScheduleId = scheduleId, name = PlanName });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var planId = document.RootElement.GetProperty("id").GetGuid();
        return new OwnedPlan(client, owner.Id, planId, await StoredAsync(planId));
    }

    private static Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        string endpoint,
        object planId,
        Guid scheduleId) =>
        endpoint switch
        {
            "delete" => client.DeleteAsync($"/api/plans/{planId}"),
            "duplicate" => client.PostAsync($"/api/plans/{planId}/copies", content: null),
            "rename" => client.PutAsJsonAsync($"/api/plans/{planId}/name", new { name = "Taken over" }),
            _ => client.PutAsJsonAsync(
                $"/api/plans/{planId}",
                new { generatedScheduleId = scheduleId, name = "Taken over" })
        };

    // The owner's plan still exists, unchanged, and was not copied: the owner still has exactly this one plan.
    private async Task AssertUnchangedAsync(OwnedPlan owned)
    {
        Assert.Equal(owned.Before, await StoredAsync(owned.PlanId));
        Assert.Equal(1, await CountPlansOfAsync(owned.OwnerId));
    }

    // The body may be the API's standard 403 problem body, but nothing of the plan (contracts/plans-api.md).
    private static async Task AssertNoPlanDataAsync(HttpResponseMessage response, Guid planId)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(PlanName, body);
        Assert.DoesNotContain(planId.ToString(), body);
        Assert.DoesNotContain("\"scheduled\"", body);
        Assert.DoesNotContain("\"locationName\"", body);
        Assert.DoesNotContain("\"dates\"", body);
    }

    private async Task<Stored> StoredAsync(Guid planId)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = await context.SavedPlans.AsNoTracking().SingleAsync(saved => saved.Id == planId);
        return new Stored(plan.Name, plan.SavedAtUtc, plan.GeneratedScheduleId, JsonSerializer.Serialize(plan.Snapshot));
    }

    private async Task<int> CountPlansOfAsync(string ownerId)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await context.SavedPlans.CountAsync(plan => plan.OwnerId == ownerId);
    }

    private static async Task SignInAsync(HttpClient client, ApplicationUser account)
    {
        using var response = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(account.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
