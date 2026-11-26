using System.Net;
using System.Text;
using static SpekLaiku.IntegrationTests.AccountDeletionRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/account/delete</c> with the correct password (feature 016 contracts/account-deletion-api.md, spec
/// FR-003, FR-004, SC-003): the account and all its plans are deleted, the user is signed out, and nothing else
/// changes. Passwords and the lock are in <c>AccountDeletionPasswordTests</c>, authorization in
/// <c>AccountDeletionAuthorizationTests</c>.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AccountDeletionEndpointTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task CorrectPassword_Answers204AndRemovesTheSessionCookie()
    {
        var (_, client) = await factory.CreateSignedInUserAsync();

        using var response = await DeleteAccountAsync(client);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
        var cookie = Assert.Single(
            response.Headers.GetValues("Set-Cookie"),
            header => header.StartsWith(".AspNetCore.Identity.Application=", StringComparison.Ordinal));
        // An expiry in the past tells the browser to remove the cookie.
        Assert.Contains("expires=Thu, 01 Jan 1970", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CorrectPassword_DeletesTheAccountAndAllItsPlans()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        await SeedPlanAsync(factory, user.Id);
        await SeedPlanAsync(factory, user.Id);

        using var response = await DeleteAccountAsync(client);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(await AccountExistsAsync(factory, user.Id));
        Assert.Equal(0, await PlanCountAsync(factory, user.Id));
    }

    [Fact]
    public async Task Deletion_LeavesOtherAccountsAndTheirPlansUnchanged()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        await SeedPlanAsync(factory, user.Id);
        var other = await factory.CreateUserAsync();
        await SeedPlanAsync(factory, other.Id);

        using var response = await DeleteAccountAsync(client);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True(await AccountExistsAsync(factory, other.Id));
        Assert.Equal(1, await PlanCountAsync(factory, other.Id));
    }

    [Fact]
    public async Task AccountWithNoPlans_IsDeleted()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();

        using var response = await DeleteAccountAsync(client);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(await AccountExistsAsync(factory, user.Id));
    }

    [Fact]
    public async Task AfterDeletion_SameClientGets401FromMe()
    {
        var (_, client) = await factory.CreateSignedInUserAsync();
        using var deletion = await DeleteAccountAsync(client);

        using var me = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task EmptyJsonObject_Gets400EnterYourPassword()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();

        using var response = await client.PostAsync(
            DeletePath,
            new StringContent("{}", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["Enter your password."], await PasswordErrorsAsync(response));
        Assert.True(await AccountExistsAsync(factory, user.Id));
    }

    [Fact]
    public async Task MissingBody_Gets400RequestError()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();

        using var response = await client.PostAsync(
            DeletePath,
            new StringContent(string.Empty, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadAsync(response)).GetProperty("errors");
        Assert.Equal("The request is invalid.", errors.GetProperty("request")[0].GetString());
        Assert.True(await AccountExistsAsync(factory, user.Id));
    }
}
