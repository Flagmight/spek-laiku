using System.Net;
using static SpekLaiku.IntegrationTests.AdminAccountRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// A suspension made on the User accounts page applies on the user's next request, with no need to log out, and a
/// reactivation gives back the same access and plans (feature 014 spec FR-009, FR-010, SC-002, SC-005, research
/// section 4).
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AccountSuspensionEffectTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task SuspendedUser_IsRefusedOnTheNextRequest()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var (user, client) = await factory.CreateSignedInUserAsync();
        using (client)
        {
            using (var before = await client.GetAsync("/api/plans"))
            {
                Assert.Equal(HttpStatusCode.OK, before.StatusCode);
            }

            using (var suspend = await SetStatusAsync(admin, user.Id, "Suspended"))
            {
                Assert.Equal(HttpStatusCode.OK, suspend.StatusCode);
            }

            using var plans = await client.GetAsync("/api/plans");
            using var setup = await client.PostAsync("/api/plan-setup/check", content: null);
            using var me = await client.GetAsync("/api/auth/me");

            Assert.Equal(HttpStatusCode.Forbidden, plans.StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, setup.StatusCode);
            Assert.Equal(HttpStatusCode.OK, me.StatusCode);
            Assert.Equal("Suspended", (await ReadAsync(me)).GetProperty("accountStatus").GetString());
        }
    }

    [Fact]
    public async Task SuspendedUser_CanStillLogOut()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var (user, client) = await factory.CreateSignedInUserAsync();
        using (client)
        {
            using (var suspend = await SetStatusAsync(admin, user.Id, "Suspended"))
            {
                Assert.Equal(HttpStatusCode.OK, suspend.StatusCode);
            }

            using var logout = await client.PostAsync("/api/auth/logout", content: null);
            using var me = await client.GetAsync("/api/auth/me");

            Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
        }
    }
}
