using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>The password never appears in a response, a log entry or the database (FR-009, SC-004).</summary>
[Collection(PostgreSqlCollection.Name)]
public class PasswordSecrecyTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/registration";
    private const string Password = "Kn0wn-Secret-Passw0rd!";

    [Fact]
    public async Task Register_Success_NeverExposesOrLogsThePasswordAndStoresOnlyAHash()
    {
        var email = $"secret-{Guid.NewGuid():N}@example.com";
        var logs = new CapturingLoggerProvider();
        await using var app = WithLogs(factory, logs);
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var response = await client.PostAsJsonAsync(Path, Request(email, Password, Password));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.DoesNotContain(Password, await response.Content.ReadAsStringAsync());
        AssertNotLogged(logs);

        using var scope = app.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);
        Assert.False(string.IsNullOrEmpty(user.PasswordHash));
        Assert.NotEqual(Password, user.PasswordHash);
        Assert.DoesNotContain(Password, user.PasswordHash);
        Assert.True(await userManager.CheckPasswordAsync(user, Password));
    }

    [Fact]
    public async Task Register_ValidationFailures_NeverExposeOrLogThePassword()
    {
        var existing = await factory.CreateUserAsync();
        var logs = new CapturingLoggerProvider();
        await using var app = WithLogs(factory, logs);
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var mismatch = await client.PostAsJsonAsync(
            Path, Request($"new-{Guid.NewGuid():N}@example.com", Password, Password + "x"));
        var duplicate = await client.PostAsJsonAsync(Path, Request(existing.Email!, Password, Password));

        foreach (var response in new[] { mismatch, duplicate })
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.DoesNotContain(Password, await response.Content.ReadAsStringAsync());
        }

        AssertNotLogged(logs);
    }

    [Fact]
    public async Task Register_TechnicalFailure_NeverExposesOrLogsThePassword()
    {
        var logs = new CapturingLoggerProvider();
        await using var app = WithLogs(factory, logs, services =>
            services.AddScoped<IUserValidator<ApplicationUser>, FailingUserValidator>());
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var response = await client.PostAsJsonAsync(
            Path, Request($"new-{Guid.NewGuid():N}@example.com", Password, Password));

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain(Password, await response.Content.ReadAsStringAsync());
        AssertNotLogged(logs);
    }

    private static WebApplicationFactory<Program> WithLogs(
        PostgreSqlApiFactory factory,
        CapturingLoggerProvider logs,
        Action<IServiceCollection>? configureServices = null) =>
        factory.WithWebHostBuilder(builder =>
        {
            // Every level and category, overriding the appsettings.json filters for this provider.
            builder.ConfigureLogging(logging => logging
                .AddProvider(logs)
                .AddFilter<CapturingLoggerProvider>(null, LogLevel.Trace));
            if (configureServices is not null)
            {
                builder.ConfigureTestServices(configureServices);
            }
        });

    private static void AssertNotLogged(CapturingLoggerProvider logs)
    {
        // Proves the capture works, so an empty log cannot pass by accident.
        Assert.Contains(logs.Entries, entry => entry.Contains("/api/registration"));
        var leak = logs.Entries.FirstOrDefault(entry => entry.Contains(Password));
        Assert.True(leak is null, $"The password was logged: {leak}");
    }

    private static object Request(string email, string password, string confirmation) =>
        new { email, password, passwordConfirmation = confirmation };

    private sealed class FailingUserValidator : IUserValidator<ApplicationUser>
    {
        public Task<IdentityResult> ValidateAsync(UserManager<ApplicationUser> manager, ApplicationUser user) =>
            Task.FromResult(IdentityResult.Failed(new IdentityError { Code = "InvalidUserName" }));
    }
}
