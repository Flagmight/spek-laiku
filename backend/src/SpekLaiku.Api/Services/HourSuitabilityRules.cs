using System.Globalization;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Whether a planning hour meets an activity's requirements (spec FR-013 to FR-019, research section 6).
/// Every reason against the hour is returned, in the spec's order; an empty list means suitable. A value
/// equal to its limit meets it. The values are the rounded ones that are shown (research section 5).
/// </summary>
public static class HourSuitabilityRules
{
    public const string OutsideDaylight = "Outside daylight";
    public const string NoForecast = "No forecast for this hour";

    public static IReadOnlyList<string> Check(PlanningHour hour, CheckedPlanActivity activity)
    {
        var reasons = new List<string>();
        var isOutdoor = activity.Type == ActivityType.Outdoor;
        var hasAllValues = hour.TemperatureC is not null && hour.RainMmPerHour is not null && hour.WindMs is not null;

        // Indoor activities are never checked against the weather.
        if (isOutdoor && hasAllValues)
        {
            AddWeatherReasons(reasons, hour, activity);
        }

        if (activity.RequiresDaylight && !hour.Daylight)
        {
            reasons.Add(OutsideDaylight);
        }

        // Without every value the weather checks cannot run, so this replaces them (data-model.md).
        if (isOutdoor && !hasAllValues)
        {
            reasons.Add(NoForecast);
        }

        return reasons;
    }

    public static string TooCold(decimal temperature, decimal minimum) =>
        $"Too cold: {Shown(temperature)} °C, minimum {Shown(minimum)} °C";

    public static string TooWarm(decimal temperature, decimal maximum) =>
        $"Too warm: {Shown(temperature)} °C, maximum {Shown(maximum)} °C";

    public static string TooMuchRain(decimal rain, decimal maximum) =>
        $"Too much rain: {Shown(rain)} mm/h, maximum {Shown(maximum)} mm/h";

    public static string TooWindy(decimal wind, decimal maximum) =>
        $"Too windy: {Shown(wind)} m/s, maximum {Shown(maximum)} m/s";

    // Called only when the hour has every value. An Outdoor activity always has its four limits after the
    // check in feature 005; a missing one is simply not compared.
    private static void AddWeatherReasons(List<string> reasons, PlanningHour hour, CheckedPlanActivity activity)
    {
        var temperature = hour.TemperatureC!.Value;
        var rain = hour.RainMmPerHour!.Value;
        var wind = hour.WindMs!.Value;

        if (activity.MinTemperatureC is { } minimum && temperature < minimum)
        {
            reasons.Add(TooCold(temperature, minimum));
        }

        if (activity.MaxTemperatureC is { } maximum && temperature > maximum)
        {
            reasons.Add(TooWarm(temperature, maximum));
        }

        if (activity.MaxRainMmPerHour is { } maxRain && rain > maxRain)
        {
            reasons.Add(TooMuchRain(rain, maxRain));
        }

        if (activity.MaxWindMs is { } maxWind && wind > maxWind)
        {
            reasons.Add(TooWindy(wind, maxWind));
        }
    }

    private static string Shown(decimal value) => value.ToString("0.0", CultureInfo.InvariantCulture);
}
