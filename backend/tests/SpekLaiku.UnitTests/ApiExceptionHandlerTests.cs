using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SpekLaiku.Api.Errors;

namespace SpekLaiku.UnitTests;

public class ApiExceptionHandlerTests
{
    [Fact]
    public async Task TryHandleAsync_DoesNotExposeExceptionDetailsInResponse()
    {
        var services = new ServiceCollection();
        services.AddOptions();
        services.AddProblemDetails();
        using var provider = services.BuildServiceProvider();
        await using var body = new MemoryStream();
        var context = new DefaultHttpContext
        {
            RequestServices = provider
        };
        context.Response.Body = body;
        var handler = new ApiExceptionHandler(
            provider.GetRequiredService<IProblemDetailsService>(),
            NullLogger<ApiExceptionHandler>.Instance);

        var handled = await handler.TryHandleAsync(
            context,
            new InvalidOperationException("password=secret-token"),
            CancellationToken.None);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        body.Position = 0;
        using var reader = new StreamReader(body);
        var response = await reader.ReadToEndAsync();
        Assert.DoesNotContain("secret-token", response);
        Assert.Contains("request could not be completed", response);
    }
}
