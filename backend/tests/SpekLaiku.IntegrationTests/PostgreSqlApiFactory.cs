using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using Testcontainers.PostgreSql;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Runs the API against a real PostgreSQL database, so unique indexes are enforced as in production.
/// The database is a Testcontainers container, or a throwaway database on an existing server when
/// <see cref="LocalPostgreSqlDatabase.VariableName"/> is set. The schema is created by applying the
/// EF Core migrations, so the tests also prove the migrations work.
/// </summary>
public sealed class PostgreSqlApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer? container;
    private readonly LocalPostgreSqlDatabase? localDatabase;

    public PostgreSqlApiFactory()
    {
        var localServer = Environment.GetEnvironmentVariable(LocalPostgreSqlDatabase.VariableName);
        if (string.IsNullOrWhiteSpace(localServer))
        {
            container = new PostgreSqlBuilder("postgres:17-alpine").Build();
        }
        else
        {
            localDatabase = new LocalPostgreSqlDatabase(localServer);
        }
    }

    private string ConnectionString => localDatabase?.ConnectionString ?? container!.GetConnectionString();

    public async Task InitializeAsync()
    {
        if (localDatabase is not null)
        {
            await localDatabase.CreateAsync();
        }
        else
        {
            await container!.StartAsync();
        }

        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        if (localDatabase is not null)
        {
            await localDatabase.DropAsync();
        }
        else
        {
            await container!.DisposeAsync();
        }
    }

    public HttpClient CreateHttpsClient() => CreateClient(new WebApplicationFactoryClientOptions
    {
        // The sign-in cookie is Secure, so the client only sends it back over https.
        BaseAddress = new Uri("https://localhost"),
        AllowAutoRedirect = false
    });

    public async Task<ApplicationUser> CreateUserAsync(
        AccountStatus status = AccountStatus.Active,
        string password = "Password123!",
        string role = "Registered User")
    {
        var email = $"user-{Guid.NewGuid():N}@example.com";
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            Role = role,
            AccountStatus = status,
            RegistrationDate = DateTime.UtcNow
        };
        using var scope = Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var result = await userManager.CreateAsync(user, password);
        Assert.True(result.Succeeded, string.Join(", ", result.Errors.Select(error => error.Code)));
        return user;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", ConnectionString);
        builder.ConfigureServices(services => services.AddTransient<IStartupFilter, TestSignInStartupFilter>());
    }
}

[CollectionDefinition(Name)]
public sealed class PostgreSqlCollection : ICollectionFixture<PostgreSqlApiFactory>
{
    public const string Name = "PostgreSQL";
}
