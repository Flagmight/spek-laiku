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
        Assert.Contains("\"service\":\"locationSearch\"", response);
        Assert.DoesNotContain("Timeout", response);
    }

    [Theory]
    [InlineData(FailureKind.Timeout)]
    [InlineData(FailureKind.Network)]
    [InlineData(FailureKind.UnexpectedStatus)]
    [InlineData(FailureKind.InvalidResponse)]
    public async Task ForecastFailure_Answers503WithTheWeatherMessageAndService(FailureKind kind)
    {
        var (status, response) = await HandleAsync(new ExternalServiceException(ExternalService.Forecast, kind, 500));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status);
        Assert.Contains("\"title\":\"Service unavailable.\"", response);
        Assert.Contains("\"detail\":\"The weather service is unavailable. No forecast is shown.\"", response);
        Assert.Contains("\"service\":\"forecast\"", response);
        Assert.DoesNotContain(kind.ToString(), response);
    }

    [Theory]
    [InlineData(FailureKind.Timeout)]
    [InlineData(FailureKind.Network)]
    [InlineData(FailureKind.UnexpectedStatus)]
    [InlineData(FailureKind.InvalidResponse)]
    public async Task MapDataFailure_Answers503WithTheMapDataMessageAndPlacesService(FailureKind kind)
    {
        var (status, response) = await HandleAsync(new ExternalServiceException(ExternalService.MapData, kind, 504));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status);
        Assert.Contains("\"title\":\"Service unavailable.\"", response);
        Assert.Contains("\"detail\":\"The map data service is unavailable. No places are shown.\"", response);
        Assert.Contains("\"service\":\"places\"", response);
        Assert.DoesNotContain(kind.ToString(), response);
    }

    [Fact]
    public async Task UnknownExternalService_KeepsTheLocationSearchAnswer()
    {
        var (status, response) = await HandleAsync(
            new ExternalServiceException((ExternalService)99, FailureKind.Timeout));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status);
        Assert.Contains("\"service\":\"locationSearch\"", response);
    }

    [Fact]
    public async Task OtherFailure_HasNoServiceField()
    {
        var (_, response) = await HandleAsync(new InvalidOperationException("boom"));

        Assert.DoesNotContain("\"service\"", response);
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
