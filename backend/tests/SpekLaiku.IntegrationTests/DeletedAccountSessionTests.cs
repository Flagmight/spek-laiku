using System.Net;
using System.Net.Http.Json;
using static SpekLaiku.IntegrationTests.AccountDeletionRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// After a deletion, another browser still holding the deleted account's cookie is refused everywhere, the old details
/// no longer log in, and the email can be registered again with no plans (feature 016 spec FR-005, FR-006, SC-002,
/// SC-005, research sections 7 and 8). No code of this feature does this: the handlers already read the account on
/// every request.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class DeletedAccountSessionTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task OtherSession_IsRefusedEverywhere()
    {
        var (user, first) = await factory.CreateSignedInUserAsync();
        var planId = await SeedPlanAsync(factory, user.Id);
        using var second = await SignInAsync(factory, user.Email!);
        using var deletion = await DeleteAccountAsync(first);
        Assert.Equal(HttpStatusCode.NoContent, deletion.StatusCode);

        using var plans = await second.GetAsync("/api/plans");
        using var plan = await second.GetAsync($"/api/plans/{planId}");
        using var deleteAgain = await DeleteAccountAsync(second);
        using var me = await second.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Forbidden, plans.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, plan.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deleteAgain.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task OldDetails_CannotLogIn()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        using var deletion = await DeleteAccountAsync(client);

        using var signedOut = factory.CreateHttpsClient();
        using var login = await signedOut.PostAsJsonAsync(
            "/api/auth/login",
            new { email = user.Email, password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal("Incorrect email or password.", (await ReadAsync(login)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task SameEmail_CanRegisterAgainWithNoPlans()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        await SeedPlanAsync(factory, user.Id);
        using var deletion = await DeleteAccountAsync(client);
        Assert.Equal(HttpStatusCode.NoContent, deletion.StatusCode);

        using var visitor = factory.CreateHttpsClient();
        using var registration = await visitor.PostAsJsonAsync(
            "/api/registration",
            new { email = user.Email!.ToUpperInvariant(), password = Password, passwordConfirmation = Password });

        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        using var newSession = await SignInAsync(factory, user.Email!);
        using var me = await newSession.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        using var plans = await newSession.GetAsync("/api/plans");
        Assert.Equal(HttpStatusCode.OK, plans.StatusCode);
        Assert.Equal(0, (await ReadAsync(plans)).GetArrayLength());
        Assert.False(await AccountExistsAsync(factory, user.Id));
    }
}
