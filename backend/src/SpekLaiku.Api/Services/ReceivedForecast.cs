using SpekLaiku.Api.Clients;

namespace SpekLaiku.Api.Services;

/// <summary>A forecast and the moment it was received from the weather service (spec FR-009).</summary>
public sealed record ReceivedForecast(HourlyForecast Data, DateTimeOffset ReceivedAt);
