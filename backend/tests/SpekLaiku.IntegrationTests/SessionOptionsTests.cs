using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

[Collection(PostgreSqlCollection.Name)]
public class SessionOptionsTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/auth/login";
    private const string Password = "Password123!";

    [Fact]
    public void SignInCookie_ExpiresAfter30MinutesWithSlidingExpiration()
    {
        var options = factory.Services
            .GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(IdentityConstants.ApplicationScheme);

        // Sliding expiration renews the cookie after half the time, so a session lasts 15 to 30 minutes (FR-019).
        Assert.Equal(TimeSpan.FromMinutes(30), options.ExpireTimeSpan);
        Assert.True(options.SlidingExpiration);
    }

    [Fact]
    public async Task Login_WhenAlreadySignedIn_Returns403AndCountsNoFailedAttempt()
    {
        var user = await factory.CreateUserAsync(password: Password);
        using var client = factory.CreateHttpsClient();
        var login = await client.PostAsJsonAsync(Path, new { email = user.Email, password = Password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var response = await client.PostAsJsonAsync(Path, new { email = user.Email, password = "WrongPassword1!" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Already signed in.", problem.GetProperty("title").GetString());
        Assert.Equal("You are already signed in.", problem.GetProperty("detail").GetString());
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var stored = await userManager.FindByIdAsync(user.Id);
        Assert.Equal(0, await userManager.GetAccessFailedCountAsync(stored!));
    }
}
