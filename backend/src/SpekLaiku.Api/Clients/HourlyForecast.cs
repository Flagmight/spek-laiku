namespace SpekLaiku.Api.Clients;

/// <summary>The weather service's answer for one position: every hour and every day it sent, in time order.</summary>
public sealed record HourlyForecast(IReadOnlyList<ForecastHourValues> Hours, IReadOnlyList<ForecastDaylight> Days);

/// <summary>
/// The values stamped at one instant. Temperature and wind are instant values at <see cref="Time"/>;
/// precipitation is the sum of the hour <b>before</b> <see cref="Time"/> (research section 2).
/// A value is <c>null</c> when the service has none.
/// </summary>
public sealed record ForecastHourValues(
    DateTimeOffset Time,
    double? TemperatureC,
    double? PrecipitationMm,
    double? WindSpeedMs);

/// <summary>The sunrise and sunset of one Lithuanian date.</summary>
public sealed record ForecastDaylight(DateOnly Date, DateTimeOffset Sunrise, DateTimeOffset Sunset);
