using System.Net;
using System.Net.Http.Json;
using SpekLaiku.Api.Entities;
using static SpekLaiku.IntegrationTests.AccountDeletionRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Only a signed-in Active Registered User can delete an account, and only their own (feature 016 spec FR-009,
/// User Story 2, constitution III). A refused caller never reaches the password check, so no attempt is counted
/// (research section 3). Another session of a deleted account is in <c>DeletedAccountSessionTests</c>.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AccountDeletionAuthorizationTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task Visitor_Gets401WithEmptyBody()
    {
        using var client = factory.CreateHttpsClient();

        using var response = await DeleteAccountAsync(client);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("Registered User", AccountStatus.Suspended)]
    [InlineData("Administrator", AccountStatus.Active)]
    [InlineData("Administrator", AccountStatus.Suspended)]
    public async Task RefusedCallers_Get403WithTheCorrectPassword(string role, AccountStatus status)
    {
        var (user, client) = await factory.CreateSignedInUserAsync(role, status);
        await SeedPlanAsync(factory, user.Id);

        using var response = await DeleteAccountAsync(client);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(user.Email!, body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(user.Id, body);
        Assert.True(await AccountExistsAsync(factory, user.Id));
        Assert.Equal(1, await PlanCountAsync(factory, user.Id));
        Assert.Equal(0, (await LockStateAsync(factory, user.Id)).AccessFailedCount);
    }

    [Fact]
    public async Task RequestCannotNameAnotherAccount()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        var other = await factory.CreateUserAsync();
        await SeedPlanAsync(factory, other.Id);

        using var response = await client.PostAsJsonAsync(
            DeletePath,
            new { password = Password, id = other.Id, userId = other.Id, email = other.Email });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(await AccountExistsAsync(factory, user.Id));
        Assert.True(await AccountExistsAsync(factory, other.Id));
        Assert.Equal(1, await PlanCountAsync(factory, other.Id));
    }
}
