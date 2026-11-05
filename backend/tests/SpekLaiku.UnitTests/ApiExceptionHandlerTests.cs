using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Errors;

namespace SpekLaiku.UnitTests;

public class ApiExceptionHandlerTests
{
    [Fact]
    public async Task TryHandleAsync_DoesNotExposeExceptionDetailsInResponse()
    {
        var (status, response) = await HandleAsync(new InvalidOperationException("password=secret-token"));

        Assert.Equal(StatusCodes.Status500InternalServerError, status);
        Assert.DoesNotContain("secret-token", response);
        Assert.Contains("request could not be completed", response);
    }

    [Fact]
    public async Task ExternalServiceFailure_Answers503WithTheLocationSearchMessage()
    {
        var (status, response) = await HandleAsync(
            new ExternalServiceException(ExternalService.LocationSearch, FailureKind.Timeout));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status);
        Assert.Contains("\"title\":\"Service unavailable.\"", response);
        Assert.Contains("\"detail\":\"Location search is unavailable. Try again later.\"", response);
        Assert.DoesNotContain("Timeout", response);
    }

    [Fact]
    public async Task ExternalServiceFailure_IsNotLoggedAgain()
    {
        using var logs = new CapturingLoggerProvider();
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(logs));

        await HandleAsync(
            new ExternalServiceException(ExternalService.LocationSearch, FailureKind.Network),
            loggerFactory.CreateLogger<ApiExceptionHandler>());

        Assert.Empty(logs.Entries);
    }

    private static async Task<(int Status, string Body)> HandleAsync(
        Exception exception,
        ILogger<ApiExceptionHandler>? logger = null)
    {
        var services = new ServiceCollection();
        services.AddOptions();
        services.AddProblemDetails();
        await using var provider = services.BuildServiceProvider();
        await using var body = new MemoryStream();
        var context = new DefaultHttpContext
        {
            RequestServices = provider
        };
        context.Response.Body = body;
        var handler = new ApiExceptionHandler(
            provider.GetRequiredService<IProblemDetailsService>(),
            logger ?? NullLogger<ApiExceptionHandler>.Instance);

        var handled = await handler.TryHandleAsync(context, exception, CancellationToken.None);

        Assert.True(handled);
        body.Position = 0;
        using var reader = new StreamReader(body);
        return (context.Response.StatusCode, await reader.ReadToEndAsync());
    }
}
