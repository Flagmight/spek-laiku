using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SpekLaiku.Api;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;
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

    /// <summary>
    /// The location search service the API sees. The API caches its answers and the cache is shared by
    /// the collection, so every test scripts its own search texts and place ids (research section 5).
    /// </summary>
    public FakeGeocodingClient Geocoding { get; } = new();

    /// <summary>
    /// The weather service the API sees. The API caches forecasts per location id and day, and the cache is
    /// shared by the collection, so every test uses its own place id and position (feature 006 research
    /// section 4).
    /// </summary>
    public FakeForecastClient Forecast { get; } = new();

    /// <summary>
    /// The map data service the API sees. The API reuses places per location id, radius and tags, and the
    /// cache is shared by the collection, so every test uses its own place id and position (feature 007
    /// research section 5).
    /// </summary>
    public FakeMapPlacesClient MapPlaces { get; } = new();

    /// <summary>
    /// The clock behind <see cref="ForecastPeriod"/> only: the forecast period, and "now" and the received time
    /// of the forecast services, which read the time through it. Tests set it before checking dates and set
    /// it back afterwards, because the collection shares it.
    /// </summary>
    public FixedTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow);

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

    /// <summary>
    /// Creates a user with the given role and status, signs it in through the real SignInManager and
    /// returns an https client that holds the sign-in cookie.
    /// </summary>
    public async Task<HttpClient> CreateSignedInClientAsync(
        string role = "Registered User",
        AccountStatus status = AccountStatus.Active)
    {
        var user = await CreateUserAsync(status, role: role);
        var client = CreateHttpsClient();
        var response = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(user.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        return client;
    }

    /// <summary>
    /// A category name of at most 60 characters with a short random suffix. The test database, with
    /// the starter categories, is shared by the collection, so every created category needs its own
    /// name (research section 5).
    /// </summary>
    public static string UniqueCategoryName(string prefix)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var maxPrefixLength = 60 - suffix.Length - 1;
        return $"{(prefix.Length > maxPrefixLength ? prefix[..maxPrefixLength] : prefix)} {suffix}";
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", ConnectionString);
        // Every test request comes from the same (missing) address and so shares one request-limit window;
        // only the request-limit tests use a low limit, on their own host (research section 14).
        builder.UseSetting("RateLimiting:PlanSetup:PermitLimit", "10000");
        builder.ConfigureServices(services => services.AddTransient<IStartupFilter, TestSignInStartupFilter>());
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IGeocodingClient>();
            services.AddSingleton<IGeocodingClient>(Geocoding);
            services.RemoveAll<IForecastClient>();
            services.AddSingleton<IForecastClient>(Forecast);
            services.RemoveAll<IMapPlacesClient>();
            services.AddSingleton<IMapPlacesClient>(MapPlaces);
            // Only the forecast period gets the fixed clock; cookies and Identity keep the real one. The forecast
            // services read the time through ForecastPeriod, so they follow this clock too.
            services.RemoveAll<ForecastPeriod>();
            services.AddSingleton(new ForecastPeriod(Clock));
        });
    }
}

[CollectionDefinition(Name)]
public sealed class PostgreSqlCollection : ICollectionFixture<PostgreSqlApiFactory>
{
    public const string Name = "PostgreSQL";
}
