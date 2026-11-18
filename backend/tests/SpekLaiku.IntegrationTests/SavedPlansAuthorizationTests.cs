using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Saved plans belong to one Active Registered User (feature 010 spec FR-012, FR-013, User Story 5, SC-004;
/// contracts/plans-api.md; constitution III). Every endpoint refuses Visitors (401), Administrators and Suspended
/// users (403), and no user can list, open or take over another user's plan.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class SavedPlansAuthorizationTests(PostgreSqlApiFactory factory)
{
    private const string PlanName = "Owner's weekend";

    private readonly ScheduleScenario scenario = new(factory);

    public static TheoryData<string> Endpoints => new() { "save", "list", "open" };

    public static TheoryData<string, string, string> RefusedAccounts
    {
        get
        {
            var data = new TheoryData<string, string, string>();
            foreach (var endpoint in new[] { "save", "list", "open" })
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
    public async Task Visitor_Gets401WithAnEmptyBody(string endpoint)
    {
        var owned = await CreateOwnedPlanAsync();
        using var client = factory.CreateHttpsClient();
        var scheduleId = await scenario.GenerateIdAsync(client);
        var plansBefore = await CountPlansAsync();

        using var response = await SendAsync(client, endpoint, owned.PlanId, scheduleId);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync());
        Assert.Equal(plansBefore, await CountPlansAsync());
    }

    [Theory]
    [MemberData(nameof(RefusedAccounts))]
    public async Task OtherSignedInAccount_Gets403WithoutPlanData(string endpoint, string role, string status)
    {
        var owned = await CreateOwnedPlanAsync();
        using var client = await factory.CreateSignedInClientAsync(role, Enum.Parse<AccountStatus>(status));
        using var visitor = factory.CreateHttpsClient();
        var scheduleId = await scenario.GenerateIdAsync(visitor);

        using var response = await SendAsync(client, endpoint, owned.PlanId, scheduleId);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertNoPlanDataAsync(response, owned.PlanId);
        Assert.Equal(0, await CountPlansAsync(scheduleId));
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task AccountDeletedAfterSignIn_Gets403(string endpoint)
    {
        var owned = await CreateOwnedPlanAsync();
        var account = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        await SignInAsync(client, account);
        var scheduleId = await scenario.GenerateIdAsync(client);
        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            await userManager.DeleteAsync((await userManager.FindByIdAsync(account.Id))!);
        }

        using var response = await SendAsync(client, endpoint, owned.PlanId, scheduleId);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(0, await CountPlansAsync(scheduleId));
    }

    [Fact]
    public async Task AnotherUsersPlan_Gets403WithoutPlanData()
    {
        var owned = await CreateOwnedPlanAsync();
        using var other = await factory.CreateSignedInClientAsync();

        using var response = await other.GetAsync($"/api/plans/{owned.PlanId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertNoPlanDataAsync(response, owned.PlanId);
    }

    [Fact]
    public async Task AnotherUsersPlan_IsNotListed()
    {
        var owned = await CreateOwnedPlanAsync();
        using var other = await factory.CreateSignedInClientAsync();

        using var response = await other.GetAsync("/api/plans");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(owned.PlanId.ToString(), body);
        Assert.DoesNotContain(PlanName, body);
    }

    [Fact]
    public async Task SavingAScheduleAnotherUserSaved_IsRefusedAndLeavesTheirPlanAlone()
    {
        var owned = await CreateOwnedPlanAsync();
        using var other = await factory.CreateSignedInClientAsync();

        using var response = await other.PostAsJsonAsync(
            "/api/plans",
            new { generatedScheduleId = owned.ScheduleId, name = "Taken over" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "Generate the schedule again to save it.",
            document.RootElement.GetProperty("errors").GetProperty("generatedScheduleId")[0].GetString());
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plans = await context.SavedPlans.AsNoTracking()
            .Where(plan => plan.GeneratedScheduleId == owned.ScheduleId)
            .ToListAsync();
        var plan = Assert.Single(plans);
        Assert.Equal(owned.OwnerId, plan.OwnerId);
        Assert.Equal(PlanName, plan.Name);
    }

    [Fact]
    public async Task OwnerSuspendedAfterSaving_CanNoLongerOpenTheirPlan()
    {
        var owned = await CreateOwnedPlanAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var owner = (await userManager.FindByIdAsync(owned.OwnerId))!;
            owner.AccountStatus = AccountStatus.Suspended;
            await userManager.UpdateAsync(owner);
        }

        using var response = await owned.Client.GetAsync($"/api/plans/{owned.PlanId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertNoPlanDataAsync(response, owned.PlanId);
    }

    private sealed record OwnedPlan(HttpClient Client, string OwnerId, Guid PlanId, Guid ScheduleId);

    private async Task<OwnedPlan> CreateOwnedPlanAsync()
    {
        var owner = await factory.CreateUserAsync();
        var client = factory.CreateHttpsClient();
        await SignInAsync(client, owner);
        var scheduleId = await scenario.GenerateIdAsync(client);
        using var response = await client.PostAsJsonAsync("/api/plans", new { generatedScheduleId = scheduleId, name = PlanName });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return new OwnedPlan(client, owner.Id, document.RootElement.GetProperty("id").GetGuid(), scheduleId);
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, string endpoint, Guid planId, Guid scheduleId) =>
        endpoint switch
        {
            "save" => client.PostAsJsonAsync("/api/plans", new { generatedScheduleId = scheduleId, name = "Weekend" }),
            "list" => client.GetAsync("/api/plans"),
            _ => client.GetAsync($"/api/plans/{planId}")
        };

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

    private static async Task SignInAsync(HttpClient client, ApplicationUser account)
    {
        using var response = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(account.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private async Task<int> CountPlansAsync(Guid? scheduleId = null)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return scheduleId is { } id
            ? await context.SavedPlans.CountAsync(plan => plan.GeneratedScheduleId == id)
            : await context.SavedPlans.CountAsync();
    }
}
