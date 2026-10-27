using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The real Identity user and sign-in managers over an in-memory database with the production Identity rules,
/// for login unit tests. Every log entry is captured so tests can check what was logged.
/// </summary>
public sealed class IdentityTestHost : IDisposable
{
    private readonly CapturingLoggerProvider logs = new();
    private readonly ServiceProvider provider;
    private readonly IServiceScope scope;

    public IdentityTestHost()
    {
        var services = new ServiceCollection();
        services.AddLogging(logging => logging.AddProvider(logs).SetMinimumLevel(LogLevel.Trace));
        var databaseName = Guid.NewGuid().ToString();
        services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(databaseName));
        services.AddHttpContextAccessor();
        services.AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddIdentityCookies();
        services.AddIdentityCore<ApplicationUser>(IdentityOptionsSetup.Configure)
            .AddSignInManager()
            .AddEntityFrameworkStores<ApplicationDbContext>();

        provider = services.BuildServiceProvider();
        scope = provider.CreateScope();

        // SignInManager reads the current request, so give it one that resolves services from this scope.
        scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>().HttpContext =
            new DefaultHttpContext { RequestServices = scope.ServiceProvider };
    }

    public UserManager<ApplicationUser> UserManager =>
        scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

    public SignInManager<ApplicationUser> SignInManager =>
        scope.ServiceProvider.GetRequiredService<SignInManager<ApplicationUser>>();

    public ILoggerFactory LoggerFactory => provider.GetRequiredService<ILoggerFactory>();

    public IReadOnlyCollection<string> LogEntries => logs.Entries;

    public async Task<ApplicationUser> CreateUserAsync(
        string email,
        string password,
        string role = "Registered User",
        AccountStatus status = AccountStatus.Active)
    {
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            Role = role,
            AccountStatus = status,
            RegistrationDate = DateTime.UtcNow,
        };

        var result = await UserManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Creating the test user failed: {string.Join(" ", result.Errors.Select(error => error.Description))}");
        }

        return user;
    }

    public void Dispose()
    {
        scope.Dispose();
        provider.Dispose();
    }
}
