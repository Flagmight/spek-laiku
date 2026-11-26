using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api;
using SpekLaiku.Api.Data;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Requests to <c>POST /api/account/delete</c> and the stored rows, shared by the feature 016 tests
/// (contracts/account-deletion-api.md).
/// </summary>
internal static class AccountDeletionRequests
{
    public const string DeletePath = "/api/account/delete";

    /// <summary>The default password of <see cref="PostgreSqlApiFactory.CreateUserAsync"/>.</summary>
    public const string Password = "Password123!";

    public static Task<HttpResponseMessage> DeleteAccountAsync(HttpClient client, string? password = Password) =>
        client.PostAsJsonAsync(DeletePath, new { password });

    public static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    /// <summary>The <c>errors.password</c> messages of a 400 answer.</summary>
    public static async Task<string[]> PasswordErrorsAsync(HttpResponseMessage response) =>
        [.. (await ReadAsync(response)).GetProperty("errors").GetProperty("password").EnumerateArray()
            .Select(message => message.GetString() ?? string.Empty)];

    /// <summary>Writes a saved plan owned by <paramref name="ownerId"/> and returns its id.</summary>
    public static Task<Guid> SeedPlanAsync(PostgreSqlApiFactory factory, string ownerId) =>
        new SavedPlanSeed(factory).InsertAsync(
            ownerId,
            SavedPlanSeed.NewLocation(),
            [SavedPlanSeed.PlanDate],
            [],
            []);

    public static async Task<bool> AccountExistsAsync(PostgreSqlApiFactory factory, string id)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await context.Users.AsNoTracking().AnyAsync(user => user.Id == id);
    }

    public static async Task<int> PlanCountAsync(PostgreSqlApiFactory factory, string ownerId)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await context.SavedPlans.AsNoTracking().CountAsync(plan => plan.OwnerId == ownerId);
    }

    public static async Task<(int AccessFailedCount, DateTimeOffset? LockoutEnd)> LockStateAsync(
        PostgreSqlApiFactory factory,
        string id)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == id);
        return (user.AccessFailedCount, user.LockoutEnd);
    }

    /// <summary>A second https client signed in to the same account: another browser of the same user.</summary>
    public static Task<HttpClient> SignInAsync(PostgreSqlApiFactory factory, string email) =>
        SignInAsync((WebApplicationFactory<Program>)factory, email);

    /// <summary>An https client of <paramref name="host"/> signed in as <paramref name="email"/>.</summary>
    public static async Task<HttpClient> SignInAsync(WebApplicationFactory<Program> host, string email)
    {
        var client = host.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });
        using var signIn = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(email)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
        return client;
    }

    /// <summary>A login attempt from a client that is not signed in.</summary>
    public static async Task<HttpStatusCode> LoginAsync(PostgreSqlApiFactory factory, string email, string password)
    {
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        return response.StatusCode;
    }
}
