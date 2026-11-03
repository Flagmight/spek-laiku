namespace SpekLaiku.Api.Services;

/// <summary>
/// The duration and weather limit ranges for an activity (spec FR-005, FR-006, research section 7).
/// Each method returns the field's message, or <c>null</c> when the value is valid.
/// Feature 005 (Form 4, Activity settings) uses the same methods, so both forms keep the same rules.
/// </summary>
public static class ActivityLimitRules
{
    public const decimal MinDurationHours = 0.5m;
    public const decimal MaxDurationHours = 12m;
    public const decimal MinWindMs = 0m;
    public const decimal MaxWindMs = 30m;
    public const decimal MinRainMmPerHour = 0m;
    public const decimal MaxRainMmPerHour = 20m;
    public const decimal MinTemperatureC = -30m;
    public const decimal MaxTemperatureC = 45m;

    /// <summary>Missing, outside 0.5 to 12, or not a multiple of 0.5.</summary>
    public static string? CheckDuration(decimal? value) =>
        value is { } hours && hours >= MinDurationHours && hours <= MaxDurationHours && IsMultipleOf(hours, 2)
            ? null
            : "Enter a duration between 0.5 and 12 hours.";

    public static string? CheckMaxWind(decimal? value) =>
        CheckLimit(value, MinWindMs, MaxWindMs, "Enter a wind limit between 0 and 30 m/s.");

    public static string? CheckMaxRain(decimal? value) =>
        CheckLimit(value, MinRainMmPerHour, MaxRainMmPerHour, "Enter a rain limit between 0 and 20 mm/h.");

    public static string? CheckMinTemperature(decimal? value) =>
        CheckLimit(value, MinTemperatureC, MaxTemperatureC, "Enter a minimum temperature between -30 and 45 °C.");

    public static string? CheckMaxTemperature(decimal? value) =>
        CheckLimit(value, MinTemperatureC, MaxTemperatureC, "Enter a maximum temperature between -30 and 45 °C.");

    /// <summary>Call only when both temperatures are valid on their own.</summary>
    public static string? CheckTemperatureOrder(decimal min, decimal max) =>
        min < max ? null : "Minimum temperature must be lower than maximum temperature.";

    // Missing, out of range, or more than one decimal place.
    private static string? CheckLimit(decimal? value, decimal min, decimal max, string message) =>
        value is { } limit && limit >= min && limit <= max && IsMultipleOf(limit, 10) ? null : message;

    // True when value is a whole number of 1/steps: steps 2 means a multiple of 0.5,
    // steps 10 means at most one decimal place (1.50 passes, 1.25 does not).
    private static bool IsMultipleOf(decimal value, int steps) =>
        value * steps == decimal.Truncate(value * steps);
}
