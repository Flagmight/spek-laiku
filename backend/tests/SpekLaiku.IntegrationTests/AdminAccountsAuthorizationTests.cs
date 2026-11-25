using System.Net;
using SpekLaiku.Api.Entities;
using static SpekLaiku.IntegrationTests.AdminAccountRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Only a signed-in Active Administrator may list, search or change accounts (feature 014 contracts/admin-accounts-api.md
/// authorization table, spec FR-015, SC-003). A refused caller gets no account data and changes nothing. This covers
/// constitution III: an authorization test for each protected operation.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AdminAccountsAuthorizationTests(PostgreSqlApiFactory factory)
{
    public static TheoryData<string> Endpoints => ["GET list", "GET search", "PUT status"];

    public static TheoryData<string, string, string> RefusedCallers
    {
        get
        {
            var data = new TheoryData<string, string, string>();
            foreach (var endpoint in Endpoints)
            {
                data.Add(endpoint, "Registered User", nameof(AccountStatus.Active));
                data.Add(endpoint, "Registered User", nameof(AccountStatus.Suspended));
                data.Add(endpoint, "Administrator", nameof(AccountStatus.Suspended));
            }

            return data;
        }
    }

    public static TheoryData<string, string> RefusedSignedInCallers => new()
    {
        { "Registered User", nameof(AccountStatus.Active) },
        { "Registered User", nameof(AccountStatus.Suspended) },
        { "Administrator", nameof(AccountStatus.Suspended) },
    };

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task Visitor_Gets401WithEmptyBody(string endpoint)
    {
        using var client = factory.CreateHttpsClient();
        var target = await factory.CreateUserAsync();

        using var response = await SendAsync(client, endpoint, target);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [MemberData(nameof(RefusedCallers))]
    public async Task OtherSignedInUser_Gets403WithoutAccountData(string endpoint, string role, string status)
    {
        using var client = await factory.CreateSignedInClientAsync(role, Enum.Parse<AccountStatus>(status));
        var target = await factory.CreateUserAsync();

        using var response = await SendAsync(client, endpoint, target);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(target.Email!, body);
        Assert.DoesNotContain(target.Id, body);
        Assert.DoesNotContain("accounts", body);
    }

    [Theory]
    [MemberData(nameof(RefusedSignedInCallers))]
    public async Task RefusedPut_LeavesTheTargetUnchanged(string role, string status)
    {
        using var client = await factory.CreateSignedInClientAsync(role, Enum.Parse<AccountStatus>(status));
        var active = await factory.CreateUserAsync();
        var suspended = await factory.CreateUserAsync(AccountStatus.Suspended);
        var activeBefore = await StoredAsync(factory, active.Id);
        var suspendedBefore = await StoredAsync(factory, suspended.Id);

        using var suspend = await SetStatusAsync(client, active.Id, "Suspended");
        using var reactivate = await SetStatusAsync(client, suspended.Id, "Active");

        Assert.Equal(HttpStatusCode.Forbidden, suspend.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, reactivate.StatusCode);
        Assert.Equal(activeBefore, await StoredAsync(factory, active.Id));
        Assert.Equal(suspendedBefore, await StoredAsync(factory, suspended.Id));
    }

    [Fact]
    public async Task RefusedPutByAVisitor_LeavesTheTargetUnchanged()
    {
        using var client = factory.CreateHttpsClient();
        var target = await factory.CreateUserAsync();
        var before = await StoredAsync(factory, target.Id);

        using var response = await SetStatusAsync(client, target.Id, "Suspended");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(before, await StoredAsync(factory, target.Id));
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task ActiveAdministrator_Gets200(string endpoint)
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync();

        using var response = await SendAsync(client, endpoint, target);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, string endpoint, ApplicationUser target) =>
        endpoint switch
        {
            "GET list" => client.GetAsync(ListPath),
            "GET search" => client.GetAsync($"{ListPath}?search={Uri.EscapeDataString(target.Email!)}"),
            "PUT status" => SetStatusAsync(client, target.Id, "Suspended"),
            _ => throw new ArgumentOutOfRangeException(nameof(endpoint), endpoint, null)
        };
}
