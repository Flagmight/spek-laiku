using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api;
using static SpekLaiku.IntegrationTests.AccountDeletionRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// A deletion writes one entry with the account id and the plan count, a wrong password writes nothing, and the lock
/// writes one Warning; no entry contains the email or the password (feature 016 spec FR-015, research section 15).
/// Logging a technical failure is ApiExceptionHandler's, covered by its own tests.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AccountDeletionLogTests(PostgreSqlApiFactory factory)
{
    private const string Category = "SpekLaiku.Api.Services.AccountDeletionService";
    private const string WrongPassword = "Wrong-password-1";

    [Fact]
    public async Task Deletion_LogsTheIdAndPlanCountAndNoEmail()
    {
        var logs = new CapturingLoggerProvider();
        await using var host = CreateHost(logs);
        var user = await factory.CreateUserAsync();
        await SeedPlanAsync(factory, user.Id);
        await SeedPlanAsync(factory, user.Id);
        using var client = await SignInAsync(host, user.Email!);
        // The test sign-in request has the email in its address, so only the entries written after it are checked.
        var before = logs.Entries.Count;

        using var response = await DeleteAccountAsync(client);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var entry = Assert.Single(EntriesOf(logs));
        Assert.Contains("Information", entry);
        Assert.Contains("deleted with 2 saved plans", entry);
        Assert.Contains(user.Id, entry);
        Assert.DoesNotContain(logs.Entries.Skip(before), logged => logged.Contains(user.Email!, StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(logs.Entries.Skip(before), logged => logged.Contains(Password, StringComparison.Ordinal));
    }

    [Fact]
    public async Task WrongPassword_WritesNoEntry()
    {
        var logs = new CapturingLoggerProvider();
        await using var host = CreateHost(logs);
        var user = await factory.CreateUserAsync();
        using var client = await SignInAsync(host, user.Email!);
        // The test sign-in request has the email in its address, so only the entries written after it are checked.
        var before = logs.Entries.Count;

        using var response = await DeleteAccountAsync(client, WrongPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(EntriesOf(logs));
        Assert.DoesNotContain(logs.Entries.Skip(before), logged => logged.Contains(WrongPassword, StringComparison.Ordinal));
    }

    [Fact]
    public async Task Lock_LogsOneWarningWithTheIdOnly()
    {
        var logs = new CapturingLoggerProvider();
        await using var host = CreateHost(logs);
        var user = await factory.CreateUserAsync();
        using var client = await SignInAsync(host, user.Email!);
        // The test sign-in request has the email in its address, so only the entries written after it are checked.
        var before = logs.Entries.Count;

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            using var wrong = await DeleteAccountAsync(client, WrongPassword);
        }

        var entry = Assert.Single(EntriesOf(logs));
        Assert.Contains("Warning", entry);
        Assert.Contains("locked after repeated failed password checks", entry);
        Assert.Contains(user.Id, entry);
        Assert.DoesNotContain(logs.Entries.Skip(before), logged => logged.Contains(user.Email!, StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(logs.Entries.Skip(before), logged => logged.Contains(WrongPassword, StringComparison.Ordinal));
    }

    private static IEnumerable<string> EntriesOf(CapturingLoggerProvider logs) =>
        logs.Entries.Where(entry => entry.StartsWith(Category + " ", StringComparison.Ordinal));

    // The collection's database and services, with the test's own log capture (as AdminAccountLogTests does).
    private WebApplicationFactory<Program> CreateHost(CapturingLoggerProvider logs) =>
        factory.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging
            .AddProvider(logs)
            .AddFilter<CapturingLoggerProvider>(null, LogLevel.Trace)));
}
