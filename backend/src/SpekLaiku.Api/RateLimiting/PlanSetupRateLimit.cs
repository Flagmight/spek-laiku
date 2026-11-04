using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace SpekLaiku.Api.RateLimiting;

/// <summary>
/// Registers the plan setup request limit with the built-in rate limiting middleware (spec FR-027,
/// research section 14): a fixed window per client network address, refused at once with <c>429</c>.
/// Behind a reverse proxy the forwarded-headers middleware must be configured, or every user shares
/// the proxy's address and therefore one limit.
/// </summary>
public static class PlanSetupRateLimit
{
    public const string RejectionTitle = "Too many requests.";
    public const string RejectionDetail = "Too many requests. Wait a minute and try again.";

    /// <summary>Used when a request has no remote address, for example in the test server.</summary>
    public const string UnknownAddress = "unknown";

    public static IServiceCollection AddPlanSetupRateLimit(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<PlanSetupRateLimitOptions>()
            .Bind(configuration.GetSection(PlanSetupRateLimitOptions.SectionName))
            .Validate(
                options => options.PermitLimit > 0 && options.WindowSeconds > 0,
                "RateLimiting:PlanSetup:PermitLimit and WindowSeconds must be positive.")
            .ValidateOnStart();

        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.AddPolicy(RateLimitPolicies.PlanSetup, httpContext =>
            {
                var settings = httpContext.RequestServices.GetRequiredService<IOptions<PlanSetupRateLimitOptions>>().Value;
                return RateLimitPartition.GetFixedWindowLimiter(
                    httpContext.Connection.RemoteIpAddress?.ToString() ?? UnknownAddress,
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = settings.PermitLimit,
                        Window = TimeSpan.FromSeconds(settings.WindowSeconds),
                        QueueLimit = 0
                    });
            });
            limiter.OnRejected = WriteRejectionAsync;
        });

        return services;
    }

    // A refused request is not a service failure, so nothing is logged here (spec FR-027).
    private static async ValueTask WriteRejectionAsync(OnRejectedContext context, CancellationToken cancellationToken)
    {
        var httpContext = context.HttpContext;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            httpContext.Response.Headers.RetryAfter =
                ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
        }

        var problemDetailsService = httpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = RejectionTitle,
                Detail = RejectionDetail
            }
        });
    }
}
