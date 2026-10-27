using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

[Collection(PostgreSqlCollection.Name)]
public class LoginEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/auth/login";
    private const string Password = "Password123!";

    [Fact]
    public async Task Login_CorrectDetails_Returns200WithUserAndSignsIn()
    {
        var user = await factory.CreateUserAsync(password: Password);
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsJsonAsync(Path, new { email = user.Email, password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(
            new CurrentUserResponse(user.Email!, "Registered User", "Active"),
            JsonSerializer.Deserialize<CurrentUserResponse>(body, JsonSerializerOptions.Web));
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.StartsWith(".AspNetCore.Identity.Application=", cookie);

        var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task Login_EmailInOtherCase_Returns200()
    {
        var user = await factory.CreateUserAsync(password: Password);
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsJsonAsync(
            Path, new { email = user.Email!.ToUpperInvariant(), password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_UnknownEmail_Returns401WithIncorrectDetailsAndNoCookie()
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsJsonAsync(
            Path, new { email = $"nobody-{Guid.NewGuid():N}@example.com", password = Password });

        await AssertIncorrectCredentialsAsync(response);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401WithIncorrectDetailsAndNoCookie()
    {
        var user = await factory.CreateUserAsync(password: Password);
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsJsonAsync(Path, new { email = user.Email, password = "WrongPassword1!" });

        await AssertIncorrectCredentialsAsync(response);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Login_ResponseNeverContainsPasswordOrHash()
    {
        var user = await factory.CreateUserAsync(password: Password);
        using var client = factory.CreateHttpsClient();

        var success = await client.PostAsJsonAsync(Path, new { email = user.Email, password = Password });
        using var otherClient = factory.CreateHttpsClient();
        var failure = await otherClient.PostAsJsonAsync(Path, new { email = user.Email, password = "WrongPassword1!" });

        foreach (var body in new[]
        {
            await success.Content.ReadAsStringAsync(),
            await failure.Content.ReadAsStringAsync()
        })
        {
            Assert.DoesNotContain(Password, body);
            Assert.DoesNotContain("WrongPassword1!", body);
            Assert.DoesNotContain(user.PasswordHash!, body);
            Assert.DoesNotContain("passwordHash", body, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static async Task AssertIncorrectCredentialsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Incorrect email or password.", problem.GetProperty("title").GetString());
        Assert.Equal("Incorrect email or password.", problem.GetProperty("detail").GetString());
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }
}
