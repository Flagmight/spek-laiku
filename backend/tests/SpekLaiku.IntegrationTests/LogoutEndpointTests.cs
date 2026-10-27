using System.Net;
using System.Net.Http.Json;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

[Collection(PostgreSqlCollection.Name)]
public class LogoutEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/auth/logout";
    private const string Password = "Password123!";

    public static TheoryData<AccountStatus, string> SignedInUsers => new()
    {
        { AccountStatus.Active, "Registered User" },
        { AccountStatus.Active, "Administrator" },
        { AccountStatus.Suspended, "Registered User" }
    };

    [Theory]
    [MemberData(nameof(SignedInUsers))]
    public async Task Logout_SignedInUser_Returns204AndEndsTheSession(AccountStatus status, string role)
    {
        var user = await factory.CreateUserAsync(status, Password, role);
        using var client = factory.CreateHttpsClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = Password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var response = await client.PostAsync(Path, content: null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        // SignOutAsync also clears Identity's external and two-factor cookies; the sign-in one matters here.
        var cookie = Assert.Single(
            response.Headers.GetValues("Set-Cookie"),
            value => value.StartsWith(".AspNetCore.Identity.Application=", StringComparison.Ordinal));
        Assert.StartsWith(".AspNetCore.Identity.Application=;", cookie);
        Assert.Contains("expires=Thu, 01 Jan 1970", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Logout_WithoutSession_Returns204()
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsync(Path, content: null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
