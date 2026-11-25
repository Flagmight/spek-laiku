using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api;
using SpekLaiku.Api.Entities;
using static SpekLaiku.IntegrationTests.AdminAccountRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Each status change writes one entry with the two account ids and no email; a repeat writes none (feature 014
/// spec FR-021, research section 9). Logging a technical failure is ApiExceptionHandler's, covered by its own tests.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AdminAccountLogTests(PostgreSqlApiFactory factory)
{
    private const string Category = "SpekLaiku.Api.Services.AdminAccountService";

    [Fact]
    public async Task Suspension_LogsBothIdsAndNoEmail()
    {
        var logs = new CapturingLoggerProvider();
        await using var host = CreateHost(logs);
        var admin = await factory.CreateUserAsync(role: "Administrator");
        var target = await factory.CreateUserAsync();
        using var client = await SignedInClientAsync(host, admin.Email!);

        using var response = await SetStatusAsync(client, target.Id, "Suspended");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entry = Assert.Single(EntriesOf(logs));
        Assert.Contains("suspended by administrator", entry);
        Assert.Contains(target.Id, entry);
        Assert.Contains(admin.Id, entry);
        Assert.DoesNotContain(target.Email!, entry);
        Assert.DoesNotContain(admin.Email!, entry);
    }

    [Fact]
    public async Task Reactivation_LogsBothIdsAndNoEmail()
    {
        var logs = new CapturingLoggerProvider();
        await using var host = CreateHost(logs);
        var admin = await factory.CreateUserAsync(role: "Administrator");
        var target = await factory.CreateUserAsync(AccountStatus.Suspended);
        using var client = await SignedInClientAsync(host, admin.Email!);

        using var response = await SetStatusAsync(client, target.Id, "Active");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entry = Assert.Single(EntriesOf(logs));
        Assert.Contains("reactivated by administrator", entry);
        Assert.Contains(target.Id, entry);
        Assert.Contains(admin.Id, entry);
        Assert.DoesNotContain(target.Email!, entry);
        Assert.DoesNotContain(admin.Email!, entry);
    }

    [Fact]
    public async Task RepeatedSuspension_WritesNoEntry()
    {
        var logs = new CapturingLoggerProvider();
        await using var host = CreateHost(logs);
        var admin = await factory.CreateUserAsync(role: "Administrator");
        var target = await factory.CreateUserAsync(AccountStatus.Suspended);
        using var client = await SignedInClientAsync(host, admin.Email!);

        using var response = await SetStatusAsync(client, target.Id, "Suspended");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(EntriesOf(logs));
    }

    private static IEnumerable<string> EntriesOf(CapturingLoggerProvider logs) =>
        logs.Entries.Where(entry => entry.StartsWith(Category + " ", StringComparison.Ordinal));

    // The collection's database and services, with the test's own log capture (as PlanCheckFailureTests does).
    private WebApplicationFactory<Program> CreateHost(CapturingLoggerProvider logs) =>
        factory.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging
            .AddProvider(logs)
            .AddFilter<CapturingLoggerProvider>(null, LogLevel.Trace)));

    private static async Task<HttpClient> SignedInClientAsync(WebApplicationFactory<Program> host, string email)
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
}
