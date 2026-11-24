namespace SpekLaiku.Api.Clients;

/// <summary>
/// One configured map data server (feature 017 data-model.md). <see cref="Address"/> is absolute and ends with
/// <c>/</c>; the client sends to <c>new Uri(Address, "api/interpreter")</c>. <see cref="Timeout"/> is the server's
/// configured waiting time.
/// </summary>
public sealed record MapDataServer(Uri Address, MapDataServerRole Role, TimeSpan Timeout);
