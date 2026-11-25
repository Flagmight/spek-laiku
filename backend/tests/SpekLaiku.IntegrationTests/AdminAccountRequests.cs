using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Requests to the feature 014 account endpoints, and the stored account row, shared by the account tests
/// (contracts/admin-accounts-api.md).
/// </summary>
internal static class AdminAccountRequests
{
    public const string ListPath = "/api/admin/accounts";

    public static string StatusPath(string id) => $"{ListPath}/{Uri.EscapeDataString(id)}/status";

    public static Task<HttpResponseMessage> SetStatusAsync(HttpClient client, string id, string? accountStatus) =>
        client.PutAsJsonAsync(StatusPath(id), new { accountStatus });

    public static async Task<(HttpStatusCode Status, JsonElement Body)> ListAsync(HttpClient client, string search)
    {
        using var response = await client.GetAsync($"{ListPath}?search={Uri.EscapeDataString(search)}");
        var text = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, text.Length == 0 ? default : JsonDocument.Parse(text).RootElement.Clone());
    }

    public static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    /// <summary>The account row as stored, read without tracking.</summary>
    public static async Task<StoredAccount> StoredAsync(PostgreSqlApiFactory factory, string id)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == id);
        return new StoredAccount(
            user.Email,
            user.Role,
            user.AccountStatus,
            user.RegistrationDate,
            user.PasswordHash,
            user.SecurityStamp,
            user.ConcurrencyStamp);
    }

    /// <summary>A marker unique to one test, put in its accounts' emails so a search finds only them.</summary>
    public static string Marker(string prefix) => $"{prefix}-{Guid.NewGuid():N}";

    public static string Email(string marker, string name) => $"{name}.{marker}@example.com";
}

internal sealed record StoredAccount(
    string? Email,
    string Role,
    AccountStatus AccountStatus,
    DateTime RegistrationDate,
    string? PasswordHash,
    string? SecurityStamp,
    string? ConcurrencyStamp);
