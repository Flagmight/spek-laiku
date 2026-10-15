using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

[Collection(PostgreSqlCollection.Name)]
public class RegistrationEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/registration";
    private const string Password = "Password123!";

    [Fact]
    public async Task Register_ValidDetails_Returns201AndSignsTheNewUserIn()
    {
        var email = NewEmail();
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsJsonAsync(Path, Request(email));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(
            new RegistrationResponse(true, "Account created.", "Active"),
            JsonSerializer.Deserialize<RegistrationResponse>(body, JsonSerializerOptions.Web));
        Assert.DoesNotContain(Password, body);
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.StartsWith(".AspNetCore.Identity.Application=", cookie);

        var me = await client.GetFromJsonAsync<CurrentUserResponse>("/api/auth/me");
        Assert.Equal(new CurrentUserResponse(email, "Registered User", "Active"), me);
    }

    [Fact]
    public async Task Register_EmailAlreadyRegisteredInOtherCase_Returns400WithEmailError()
    {
        var existing = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsJsonAsync(Path, Request(existing.Email!.ToUpperInvariant()));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("One or more request fields are invalid.", problem.GetProperty("title").GetString());
        var errors = problem.GetProperty("errors");
        Assert.Equal(["email"], errors.EnumerateObject().Select(error => error.Name));
        Assert.Equal(
            ["This email is already registered."],
            errors.GetProperty("email").EnumerateArray().Select(message => message.GetString()));
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(1, await CountUsersAsync(existing.Email));
    }

    [Fact]
    public async Task Register_AccountCreationFails_Returns500AndLeavesNoAccount()
    {
        var email = NewEmail();
        await using var failingFactory = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(
            services => services.AddScoped<IUserValidator<ApplicationUser>, FailingUserValidator>()));
        using var client = failingFactory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var response = await client.PostAsJsonAsync(Path, Request(email));

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Something went wrong.", problem.GetProperty("title").GetString());
        Assert.Equal("Something went wrong. Try again.", problem.GetProperty("detail").GetString());
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(0, await CountUsersAsync(email));
    }

    [Fact]
    public async Task Register_TwoSimultaneousRequestsWithSameEmail_CreateExactlyOneAccount()
    {
        var email = NewEmail();
        using var first = factory.CreateHttpsClient();
        using var second = factory.CreateHttpsClient();

        var responses = await Task.WhenAll(
            first.PostAsJsonAsync(Path, Request(email)),
            second.PostAsJsonAsync(Path, Request(email)));

        Assert.Equal(
            [HttpStatusCode.Created, HttpStatusCode.BadRequest],
            responses.Select(response => response.StatusCode).Order());
        var rejected = responses.Single(response => response.StatusCode == HttpStatusCode.BadRequest);
        var problem = await rejected.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(
            "This email is already registered.",
            problem.GetProperty("errors").GetProperty("email")[0].GetString());
        Assert.Equal(1, await CountUsersAsync(email));
    }

    [Fact]
    public async Task Register_SignedInUser_Returns403AndCreatesNoAccount()
    {
        var signedIn = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        var signIn = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(signedIn.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
        var email = NewEmail();

        var response = await client.PostAsJsonAsync(Path, Request(email));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Already signed in.", problem.GetProperty("title").GetString());
        Assert.Equal("You are already signed in.", problem.GetProperty("detail").GetString());
        Assert.Equal(0, await CountUsersAsync(email));
    }

    [Fact]
    public async Task Register_SignedInUserWithInvalidDetails_Returns403NotValidationErrors()
    {
        var signedIn = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(signedIn.Email!)}", content: null);

        var response = await client.PostAsJsonAsync(
            Path, new { email = "", password = "", passwordConfirmation = "" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static string NewEmail() => $"new-{Guid.NewGuid():N}@example.com";

    private static object Request(string email) =>
        new { email, password = Password, passwordConfirmation = Password };

    private async Task<int> CountUsersAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var normalizedEmail = userManager.NormalizeEmail(email);
        return userManager.Users.Count(user => user.NormalizedEmail == normalizedEmail);
    }

    /// <summary>Makes Identity reject every new account with an error that is not a duplicate.</summary>
    private sealed class FailingUserValidator : IUserValidator<ApplicationUser>
    {
        public Task<IdentityResult> ValidateAsync(UserManager<ApplicationUser> manager, ApplicationUser user) =>
            Task.FromResult(IdentityResult.Failed(new IdentityError { Code = "InvalidUserName" }));
    }
}
