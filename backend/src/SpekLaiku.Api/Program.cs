using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Errors;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.RateLimiting;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddControllers()
            // The web defaults read "8" as the number 8; the contract refuses a string for a number
            // field as an invalid request (contracts/categories-api.md).
            .AddJsonOptions(options => options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.Strict);
        builder.Services.Configure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = context =>
            {
                var failedKeys = context.ModelState
                    .Where(entry => entry.Value?.Errors.Count > 0)
                    .Select(entry => entry.Key)
                    .ToList();
                // A body that is empty or not valid JSON is reported under "$" paths or an empty key,
                // and is one request error, not field errors (contracts/registration-api.md).
                var bodyUnreadable = failedKeys.Count == 0
                    || failedKeys.Any(key => key.Length == 0 || key.StartsWith('$'));
                var errors = bodyUnreadable
                    ? new Dictionary<string, string[]> { ["request"] = ["The request is invalid."] }
                    : failedKeys.ToDictionary(key => key, _ => new[] { "Invalid value." });

                return new BadRequestObjectResult(new ValidationProblemDetails(errors)
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "One or more request fields are invalid."
                });
            };
        });
        builder.Services.AddProblemDetails();
        builder.Services.AddExceptionHandler<ApiExceptionHandler>();
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
        {
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    "Set ConnectionStrings:DefaultConnection using environment-specific configuration.");
            }

            options.UseNpgsql(connectionString);
        });
        builder.Services.AddIdentityCore<ApplicationUser>(IdentityOptionsSetup.Configure)
            .AddSignInManager()
            .AddEntityFrameworkStores<ApplicationDbContext>();
        builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddIdentityCookies();
        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
            options.SlidingExpiration = true;
            options.Events.OnRedirectToLogin = context =>
            {
                // The API contract defines 401 with no body, so status code pages must not add one.
                var statusCodePages = context.HttpContext.Features.Get<IStatusCodePagesFeature>();
                if (statusCodePages is not null)
                {
                    statusCodePages.Enabled = false;
                }

                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });
        // The handler reads the account on every request, so a role or status change applies at once
        // (research section 1).
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy(AuthorizationPolicies.ActiveAdministrator, policy => policy
                .RequireAuthenticatedUser()
                .AddRequirements(new ActiveAdministratorRequirement()))
            // Visitors are allowed, so this policy does not require a signed-in user (research section 8).
            .AddPolicy(AuthorizationPolicies.PlanCreator, policy => policy
                .AddRequirements(new PlanCreatorRequirement()));
        builder.Services.AddScoped<IAuthorizationHandler, ActiveAdministratorHandler>();
        builder.Services.AddScoped<IAuthorizationHandler, PlanCreatorHandler>();
        builder.Services.AddPlanSetupRateLimit(builder.Configuration);
        builder.Services.AddMemoryCache();
        builder.Services.TryAddSingleton(TimeProvider.System);
        builder.Services.AddSingleton<ForecastPeriod>();
        builder.Services.AddHttpClient<IGeocodingClient, OpenMeteoGeocodingClient>(client =>
            {
                client.BaseAddress = OpenMeteoGeocodingClient.BaseAddress;
                client.Timeout = OpenMeteoGeocodingClient.Timeout;
            })
            // The default client logging writes each request address, which holds the search text (spec FR-008).
            .RemoveAllLoggers();
        builder.Services.AddOptions<ForecastOptions>()
            .Bind(builder.Configuration.GetSection(ForecastOptions.SectionName))
            .Validate(ForecastOptions.IsValid, ForecastOptions.InvalidMessage)
            .ValidateOnStart();
        builder.Services.AddHttpClient<IForecastClient, OpenMeteoForecastClient>(client =>
            {
                client.BaseAddress = OpenMeteoForecastClient.BaseAddress;
                client.Timeout = OpenMeteoForecastClient.Timeout;
            })
            // The request address holds the plan's position and dates; only the client's own warning is logged.
            .RemoveAllLoggers();
        builder.Services.AddOptions<PlacesOptions>()
            .Bind(builder.Configuration.GetSection(PlacesOptions.SectionName))
            .Validate(PlacesOptions.IsValid, PlacesOptions.InvalidMessage)
            .ValidateOnStart();
        builder.Services.AddHttpClient<IMapPlacesClient, OverpassMapPlacesClient>(OverpassMapPlacesClient.Configure)
            // The request body holds the plan's position; only the client's own warning is logged.
            .RemoveAllLoggers();
        builder.Services.AddScoped<LocationSearchService>();
        builder.Services.AddScoped<PlanSetupService>();
        builder.Services.AddScoped<PlanActivityService>();
        builder.Services.AddScoped<PlanRecheckService>();
        builder.Services.AddScoped<WeatherForecastService>();
        builder.Services.AddScoped<PlanForecastService>();
        builder.Services.AddAutoMapper(_ => { }, typeof(RegistrationMappingProfile).Assembly);
        builder.Services.AddScoped<RegistrationService>();
        builder.Services.AddScoped<CurrentUserService>();
        builder.Services.AddScoped<LoginService>();
        builder.Services.AddScoped<ActivityCategoryService>();

        var app = builder.Build();

        app.UseExceptionHandler();
        app.UseStatusCodePages();
        app.UseAuthentication();
        // Before authorization, so a refused request never reaches the account lookup, the cache or the
        // location search service (research section 14).
        app.UseRateLimiter();
        app.UseAuthorization();
        app.MapControllers();

        app.Run();
    }
}
