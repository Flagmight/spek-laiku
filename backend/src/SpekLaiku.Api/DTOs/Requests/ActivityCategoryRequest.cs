namespace SpekLaiku.Api.DTOs.Requests;

// The fields are nullable so that missing values reach ActivityCategoryValidator and get the
// field messages instead of the generic model-validation error. The frontend sends null for a
// number field that is empty or not a number, which gives the same message as out of range.
// Type is a string, not ActivityType, so a wrong value gives "Select a type." (research section 6).
public sealed record ActivityCategoryRequest(
    string? Name,
    string? Type,
    decimal? DefaultDurationHours,
    bool RequiresDaylight,
    decimal? MaxWindMs,
    decimal? MaxRainMmPerHour,
    decimal? MinTemperatureC,
    decimal? MaxTemperatureC,
    string? PlaceTags);
