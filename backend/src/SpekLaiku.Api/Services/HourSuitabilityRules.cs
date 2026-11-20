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

    /// <summary>
    /// The weather limits the hour breaks, in the order cold, warm, rain, wind (feature 012 research section 5).
    /// Empty for an Indoor activity and for an hour without every value. An Outdoor activity always has its four
    /// limits after the check in feature 005; a missing one is simply not compared.
    /// </summary>
    public static IReadOnlyList<LimitBreach> Breaches(PlanningHour hour, CheckedPlanActivity activity)
    {
        if (activity.Type != ActivityType.Outdoor
            || hour.TemperatureC is not { } temperature
            || hour.RainMmPerHour is not { } rain
            || hour.WindMs is not { } wind)
        {
            return [];
        }

        var breaches = new List<LimitBreach>();

        if (activity.MinTemperatureC is { } minimum && temperature < minimum)
        {
            breaches.Add(new LimitBreach(PlanRule.Cold, temperature, minimum));
        }

        if (activity.MaxTemperatureC is { } maximum && temperature > maximum)
        {
            breaches.Add(new LimitBreach(PlanRule.Heat, temperature, maximum));
        }

        if (activity.MaxRainMmPerHour is { } maxRain && rain > maxRain)
        {
            breaches.Add(new LimitBreach(PlanRule.Rain, rain, maxRain));
        }

        if (activity.MaxWindMs is { } maxWind && wind > maxWind)
        {
            breaches.Add(new LimitBreach(PlanRule.Wind, wind, maxWind));
        }

        return breaches;
    }

    // Called only for an Outdoor activity when the hour has every value.
    private static void AddWeatherReasons(List<string> reasons, PlanningHour hour, CheckedPlanActivity activity)
    {
        foreach (var breach in Breaches(hour, activity))
        {
            reasons.Add(breach.Rule switch
            {
                PlanRule.Cold => TooCold(breach.Value, breach.Limit),
                PlanRule.Heat => TooWarm(breach.Value, breach.Limit),
                PlanRule.Rain => TooMuchRain(breach.Value, breach.Limit),
                PlanRule.Wind => TooWindy(breach.Value, breach.Limit),
                _ => throw new InvalidOperationException($"{breach.Rule} is not a weather limit."),
            });
        }
    }

    private static string Shown(decimal value) => value.ToString("0.0", CultureInfo.InvariantCulture);
}
