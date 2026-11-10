using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.Api.Errors;

/// <summary>
/// The one place where failures become responses (constitution IV): an external service that cannot
/// answer gives <c>503</c> with a message for that service and a <c>service</c> field the page can tell
/// apart (feature 006 research section 11), anything else a general <c>500</c>. No details of the failure
/// reach the client.
/// </summary>
public sealed class ApiExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var problem = exception is ExternalServiceException failure
            ? ServiceUnavailable(failure.Service)
            : Unexpected(exception);
        httpContext.Response.StatusCode = problem.Status!.Value;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem
        });
    }

    // The client already logged the kind of failure, so it is not logged twice.
    private static ProblemDetails ServiceUnavailable(ExternalService service)
    {
        var (name, detail) = service switch
        {
            ExternalService.Forecast => ("forecast", "The weather service is unavailable. No forecast is shown."),
            _ => ("locationSearch", "Location search is unavailable. Try again later.")
        };

        return new ProblemDetails
        {
            Status = StatusCodes.Status503ServiceUnavailable,
            Title = "Service unavailable.",
            Detail = detail,
            Extensions = { ["service"] = name }
        };
    }

    private ProblemDetails Unexpected(Exception exception)
    {
        logger.LogError(
            "Unhandled API exception of type {ExceptionType}",
            exception.GetType().Name);

        return new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An unexpected error occurred.",
            Detail = "The request could not be completed."
        };
    }
}
