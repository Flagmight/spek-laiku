using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using Testcontainers.PostgreSql;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Runs the API against a PostgreSQL container, so unique indexes are enforced as in production.
/// The schema is created from the current EF Core model.
/// </summary>
public sealed class PostgreSqlApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer container = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public async Task InitializeAsync()
    {
        await container.StartAsync();
        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.EnsureCreatedAsync();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await container.DisposeAsync();
    }

    public HttpClient CreateHttpsClient() => CreateClient(new WebApplicationFactoryClientOptions
    {
        // The sign-in cookie is Secure, so the client only sends it back over https.
        BaseAddress = new Uri("https://localhost"),
        AllowAutoRedirect = false
    });

    public async Task<ApplicationUser> CreateUserAsync(
        AccountStatus status = AccountStatus.Active,
        string password = "Password123!")
    {
        var email = $"user-{Guid.NewGuid():N}@example.com";
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            Role = "Registered User",
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
        builder.UseSetting("ConnectionStrings:DefaultConnection", container.GetConnectionString());
        builder.ConfigureServices(services => services.AddTransient<IStartupFilter, TestSignInStartupFilter>());
    }
}

[CollectionDefinition(Name)]
public sealed class PostgreSqlCollection : ICollectionFixture<PostgreSqlApiFactory>
{
    public const string Name = "PostgreSQL";
}
