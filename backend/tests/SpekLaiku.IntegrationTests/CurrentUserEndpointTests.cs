using System.Net;
using System.Net.Http.Json;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

[Collection(PostgreSqlCollection.Name)]
public class CurrentUserEndpointTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task GetMe_SignedOut_Returns401WithNoBody()
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task GetMe_SignedIn_ReturnsEmailRoleAndStatus()
    {
        var user = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        await SignInAsync(client, user);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<CurrentUserResponse>();
        Assert.Equal(new CurrentUserResponse(user.Email!, "Registered User", "Active"), body);
    }

    [Fact]
    public async Task GetMe_SignedInSuspendedUser_ReturnsSuspendedStatus()
    {
        var user = await factory.CreateUserAsync(AccountStatus.Suspended);
        using var client = factory.CreateHttpsClient();
        await SignInAsync(client, user);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<CurrentUserResponse>();
        Assert.Equal("Suspended", body!.AccountStatus);
    }

    [Fact]
    public async Task GetMe_ResponseNeverContainsPasswordHash()
    {
        var user = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        await SignInAsync(client, user);

        var body = await client.GetStringAsync("/api/auth/me");

        Assert.DoesNotContain("password", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(user.PasswordHash!, body);
    }

    [Fact]
    public async Task SignIn_SetsHttpOnlySecureLaxSessionCookie()
    {
        var user = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(user.Email!)}", content: null);

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.StartsWith(".AspNetCore.Identity.Application=", cookie);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/;", cookie, StringComparison.OrdinalIgnoreCase);
        // Not persistent: the 30-minute sliding expiration is inside the ticket, not on the cookie.
        Assert.DoesNotContain("expires=", cookie, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task SignInAsync(HttpClient client, ApplicationUser user)
    {
        var response = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(user.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
