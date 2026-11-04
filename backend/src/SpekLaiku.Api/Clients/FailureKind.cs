namespace SpekLaiku.Api.Clients;

/// <summary>Why a call to an external service failed. Only the kind is logged, never what was asked.</summary>
public enum FailureKind
{
    Timeout,
    Network,
    UnexpectedStatus,
    InvalidResponse
}
