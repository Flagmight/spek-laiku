using System.Data.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api;
using SpekLaiku.Api.Data;
using static SpekLaiku.IntegrationTests.AccountDeletionRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// The browser gives up (its 10-second timeout) just after the account row was deleted, before the commit. Once the
/// account is deleted the deletion must still be committed and logged, so the server's state and its log agree
/// (feature 016 spec FR-015, code review in T031).
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AccountDeletionCancellationTests(PostgreSqlApiFactory factory)
{
    private const string Category = "SpekLaiku.Api.Services.AccountDeletionService";

    [Fact]
    public async Task RequestAbortedAfterTheAccountDelete_StillCommitsAndLogs()
    {
        var logs = new CapturingLoggerProvider();
        await using var host = CreateAbortingHost(logs);
        var user = await factory.CreateUserAsync();
        await SeedPlanAsync(factory, user.Id);
        using var client = await SignInAsync(host, user.Email!);

        try
        {
            using var response = await DeleteAccountAsync(client);
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException)
        {
            // The aborted request gives the client no answer.
        }

        // The server goes on after the client stopped waiting, so wait for it (at most 10 seconds).
        for (var attempt = 0; attempt < 100 && !EntriesOf(logs).Any(); attempt++)
        {
            await Task.Delay(100);
        }

        Assert.False(await AccountExistsAsync(factory, user.Id));
        Assert.Equal(0, await PlanCountAsync(factory, user.Id));
        var entry = Assert.Single(EntriesOf(logs));
        Assert.Contains("deleted with 1 saved plans", entry);
    }

    private static IEnumerable<string> EntriesOf(CapturingLoggerProvider logs) =>
        logs.Entries.Where(entry =>
            entry.StartsWith(Category + " ", StringComparison.Ordinal) && entry.Contains("deleted with"));

    // The collection's database and services, with the request aborted as soon as the account row is deleted.
    private WebApplicationFactory<Program> CreateAbortingHost(CapturingLoggerProvider logs) =>
        factory.WithWebHostBuilder(builder => builder
            .ConfigureLogging(logging => logging
                .AddProvider(logs)
                .AddFilter<CapturingLoggerProvider>(null, LogLevel.Trace))
            .ConfigureTestServices(services =>
            {
                services.AddHttpContextAccessor();
                services.AddSingleton<AbortAfterAccountDelete>();
                services.ConfigureDbContext<ApplicationDbContext>((provider, options) =>
                    options.AddInterceptors(provider.GetRequiredService<AbortAfterAccountDelete>()));
            }));

    private sealed class AbortAfterAccountDelete(IHttpContextAccessor accessor) : DbCommandInterceptor
    {
        public override ValueTask<int> NonQueryExecutedAsync(
            DbCommand command,
            CommandExecutedEventData eventData,
            int result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("DELETE FROM \"AspNetUsers\"", StringComparison.Ordinal))
            {
                accessor.HttpContext?.Abort();
            }

            return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
        }
    }
}
