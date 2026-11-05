using System.Collections.Concurrent;
using System.Net;
using System.Text;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Answers every request with a scripted response (or exception) instead of calling a real service,
/// and records the requested addresses, so external clients are tested without the network
/// (constitution III).
/// </summary>
public sealed class FakeHttpMessageHandler(
    Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond) : HttpMessageHandler
{
    private readonly ConcurrentQueue<Uri> requestedUris = new();

    public IReadOnlyCollection<Uri> RequestedUris => requestedUris;

    public static FakeHttpMessageHandler Json(string body, HttpStatusCode status = HttpStatusCode.OK) =>
        new((_, _) => Task.FromResult(new HttpResponseMessage(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        }));

    public static FakeHttpMessageHandler Throws(Exception exception) =>
        new((_, _) => Task.FromException<HttpResponseMessage>(exception));

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        requestedUris.Enqueue(request.RequestUri!);
        return respond(request, cancellationToken);
    }
}
