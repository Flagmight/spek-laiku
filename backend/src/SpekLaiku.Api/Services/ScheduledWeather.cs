namespace SpekLaiku.Api.Services;

/// <summary>
/// The weather shown for a scheduled activity: the forecast at its start hour (feature 008 spec FR-008). Shared by
/// the scheduler and the plan check (feature 012 spec FR-011), so both show the same values for the same forecast.
/// </summary>
public static class ScheduledWeather
{
    /// <param name="weatherIndependent">Indoor and not requiring daylight: no values are shown.</param>
    /// <param name="start">The activity's start time.</param>
    /// <param name="day">The planning day of the activity's date.</param>
    public static WeatherSnapshot At(bool weatherIndependent, TimeOnly start, PlanningDay day)
    {
        if (weatherIndependent)
        {
            return new WeatherSnapshot(null, null, null, IsIndoor: true);
        }

        var startHour = day.Hours.FirstOrDefault(h => h.Start == start);
        return new WeatherSnapshot(startHour?.TemperatureC, startHour?.RainMmPerHour, startHour?.WindMs, IsIndoor: false);
    }
}
