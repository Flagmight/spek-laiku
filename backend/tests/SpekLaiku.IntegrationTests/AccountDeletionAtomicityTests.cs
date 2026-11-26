using System.Data.Common;
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api;
using SpekLaiku.Api.Data;
using static SpekLaiku.IntegrationTests.AccountDeletionRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// A failure part-way through a deletion, after the plans were deleted inside the transaction, leaves the account and
/// all its plans as they were (feature 016 spec FR-003, SC-004, research section 16). A real PostgreSQL rollback is
/// what is proven, so the failure is made by an interceptor on the real database.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AccountDeletionAtomicityTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task FailureAfterThePlansWereDeleted_KeepsTheAccountAndAllPlans()
    {
        await using var host = CreateFailingHost();
        var user = await factory.CreateUserAsync();
        await SeedPlanAsync(factory, user.Id);
        await SeedPlanAsync(factory, user.Id);
        using var client = await SignInAsync(host, user.Email!);

        using var response = await DeleteAccountAsync(client);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain("Account delete failed", await response.Content.ReadAsStringAsync());
        Assert.True(await AccountExistsAsync(factory, user.Id));
        Assert.Equal(2, await PlanCountAsync(factory, user.Id));
        using var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    // The collection's database and services, with every ApplicationDbContext failing on a delete from AspNetUsers.
    // ConfigureDbContext adds to the options the application registered, so the connection string is kept.
    private WebApplicationFactory<Program> CreateFailingHost() =>
        factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.ConfigureDbContext<ApplicationDbContext>(options =>
                options.AddInterceptors(new FailOnAccountDelete()))));

    private sealed class FailOnAccountDelete : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            FailIfAccountDelete(command);
            return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            FailIfAccountDelete(command);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }

        private static void FailIfAccountDelete(DbCommand command)
        {
            if (command.CommandText.Contains("DELETE FROM \"AspNetUsers\"", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Account delete failed in the test.");
            }
        }
    }
}
