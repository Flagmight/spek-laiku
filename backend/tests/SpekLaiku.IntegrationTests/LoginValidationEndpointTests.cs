using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>Field messages, the shared incorrect-credentials answer and the lockout (FR-004 to FR-008, FR-026).</summary>
[Collection(PostgreSqlCollection.Name)]
public class LoginValidationEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/auth/login";
    private const string Password = "Password123!";
    private const string WrongPassword = "WrongPassword1!";

    [Theory]
    [InlineData("""{ "email": "", "password": "" }""")]
    [InlineData("""{ "email": "   " }""")]
    [InlineData("{}")]
    public async Task Login_EmptyOrMissingFields_Returns400WithBothMessages(string json)
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsync(Path, new StringContent(json, Encoding.UTF8, "application/json"));

        var errors = await AssertValidationProblemAsync(response);
        Assert.Equal(["email", "password"], errors.EnumerateObject().Select(error => error.Name));
        Assert.Equal(["Enter your email address."], Messages(errors, "email"));
        Assert.Equal(["Enter your password."], Messages(errors, "password"));
    }

    [Fact]
    public async Task Login_InvalidEmail_Returns400WithEmailMessageOnly()
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsJsonAsync(Path, new { email = "not-an-email", password = Password });

        var errors = await AssertValidationProblemAsync(response);
        Assert.Equal(["email"], errors.EnumerateObject().Select(error => error.Name));
        Assert.Equal(["Enter a valid email address."], Messages(errors, "email"));
    }

    [Fact]
    public async Task Login_BodyNotValidJson_Returns400WithRequestError()
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsync(Path, new StringContent("{ not json", Encoding.UTF8, "application/json"));

        var errors = await AssertValidationProblemAsync(response);
        Assert.Equal(["The request is invalid."], Messages(errors, "request"));
    }

    [Fact]
    public async Task Login_FormEncodedBody_Returns415()
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsync(Path, new FormUrlEncodedContent(
            new Dictionary<string, string> { ["email"] = "user@example.com", ["password"] = Password }));

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    [Fact]
    public async Task Login_UnknownEmailWrongPasswordAndLockedAccount_ReturnIdenticalAnswers()
    {
        var user = await factory.CreateUserAsync(password: Password);
        var locked = await factory.CreateUserAsync(password: Password);
        using var client = factory.CreateHttpsClient();
        await FailFiveTimesAsync(client, locked.Email!);

        var answers = new[]
        {
            await client.PostAsJsonAsync(Path, new { email = $"nobody-{Guid.NewGuid():N}@example.com", password = Password }),
            await client.PostAsJsonAsync(Path, new { email = user.Email, password = WrongPassword }),
            await client.PostAsJsonAsync(Path, new { email = locked.Email, password = Password })
        };

        var bodies = new List<string>();
        foreach (var answer in answers)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, answer.StatusCode);
            Assert.False(answer.Headers.Contains("Set-Cookie"));
            bodies.Add(await BodyWithoutTraceIdAsync(answer));
        }

        Assert.All(bodies, body => Assert.Equal(bodies[0], body));
        Assert.Contains("Incorrect email or password.", bodies[0]);
    }

    [Fact]
    public async Task Login_AfterFiveWrongPasswords_CorrectPasswordReturns401()
    {
        var user = await factory.CreateUserAsync(password: Password);
        using var client = factory.CreateHttpsClient();
        await FailFiveTimesAsync(client, user.Email!);

        var response = await client.PostAsJsonAsync(Path, new { email = user.Email, password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Login_AfterTheLockHasEnded_CorrectPasswordReturns200()
    {
        var user = await factory.CreateUserAsync(password: Password);
        using var client = factory.CreateHttpsClient();
        await FailFiveTimesAsync(client, user.Email!);
        await SetLockoutEndAsync(user.Id, DateTimeOffset.UtcNow.AddMinutes(-1));

        var response = await client.PostAsJsonAsync(Path, new { email = user.Email, password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task FailFiveTimesAsync(HttpClient client, string email)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var response = await client.PostAsJsonAsync(Path, new { email, password = WrongPassword });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    private async Task SetLockoutEndAsync(string userId, DateTimeOffset lockoutEnd)
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByIdAsync(userId);
        var result = await userManager.SetLockoutEndDateAsync(user!, lockoutEnd);
        Assert.True(result.Succeeded);
    }

    private static async Task<JsonElement> AssertValidationProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("One or more request fields are invalid.", problem.GetProperty("title").GetString());
        return problem.GetProperty("errors");
    }

    private static IEnumerable<string?> Messages(JsonElement errors, string field) =>
        errors.GetProperty(field).EnumerateArray().Select(message => message.GetString());

    // The trace id differs per request; everything else must be identical.
    private static async Task<string> BodyWithoutTraceIdAsync(HttpResponseMessage response)
    {
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsObject();
        body.Remove("traceId");
        return body.ToJsonString();
    }
}
