namespace SpekLaiku.Api.Clients;

/// <summary>
/// An external service could not answer. <c>ApiExceptionHandler</c> turns it into <c>503</c>.
/// The message names only the service, the kind of failure and the status code, never the request text,
/// so it is safe to log (spec FR-008). Features 006 and 007 reuse this type (research section 4).
/// </summary>
public sealed class ExternalServiceException(
    ExternalService service,
    FailureKind kind,
    int? statusCode = null,
    Exception? inner = null)
    : Exception($"{service} failed: {kind}{(statusCode is null ? string.Empty : $" ({statusCode})")}.", inner)
{
    public ExternalService Service { get; } = service;

    public FailureKind Kind { get; } = kind;

    public int? StatusCode { get; } = statusCode;
}
