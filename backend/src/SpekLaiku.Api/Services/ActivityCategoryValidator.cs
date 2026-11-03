using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks the category fields (spec FR-003 to FR-010) and returns one message per failing field,
/// keyed by request field name in form order: <c>name</c>, <c>type</c>, <c>defaultDurationHours</c>,
/// <c>maxWindMs</c>, <c>maxRainMmPerHour</c>, <c>minTemperatureC</c>, <c>maxTemperatureC</c>,
/// <c>placeTags</c>. The duplicate-name rule needs the database, so it is in ActivityCategoryService.
/// </summary>
public static class ActivityCategoryValidator
{
    public const int MinNameLength = 2;
    public const int MaxNameLength = 60;

    public static ActivityCategoryValidationResult Validate(ActivityCategoryRequest request)
    {
        var errors = new Dictionary<string, string>();

        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            errors["name"] = "Enter a category name.";
        }
        else if (name.Length is < MinNameLength or > MaxNameLength)
        {
            errors["name"] = "Category name must be between 2 and 60 characters.";
        }

        // Exact names only, so "outdoor" is refused like any other unknown value.
        ActivityType? type = request.Type switch
        {
            "Indoor" => ActivityType.Indoor,
            "Outdoor" => ActivityType.Outdoor,
            _ => null
        };
        if (type is null)
        {
            errors["type"] = "Select a type.";
        }

        AddIfInvalid(errors, "defaultDurationHours", ActivityLimitRules.CheckDuration(request.DefaultDurationHours));

        // The weather limits apply only to Outdoor categories; for Indoor they are ignored and
        // stored as null whatever the request contains (spec FR-007).
        var isOutdoor = type == ActivityType.Outdoor;
        if (isOutdoor)
        {
            AddIfInvalid(errors, "maxWindMs", ActivityLimitRules.CheckMaxWind(request.MaxWindMs));
            AddIfInvalid(errors, "maxRainMmPerHour", ActivityLimitRules.CheckMaxRain(request.MaxRainMmPerHour));

            var minError = ActivityLimitRules.CheckMinTemperature(request.MinTemperatureC);
            var maxError = ActivityLimitRules.CheckMaxTemperature(request.MaxTemperatureC);
            if (minError is null && maxError is null)
            {
                // Both are valid on their own, so the order can be compared.
                minError = ActivityLimitRules.CheckTemperatureOrder(
                    request.MinTemperatureC!.Value, request.MaxTemperatureC!.Value);
            }

            AddIfInvalid(errors, "minTemperatureC", minError);
            AddIfInvalid(errors, "maxTemperatureC", maxError);
        }

        var tags = PlaceTagParser.Parse(request.PlaceTags);
        AddIfInvalid(errors, "placeTags", tags.Error);

        if (errors.Count > 0)
        {
            return ActivityCategoryValidationResult.Invalid(errors);
        }

        return ActivityCategoryValidationResult.Valid(new ValidActivityCategory(
            name,
            name.ToUpperInvariant(),
            type!.Value,
            request.DefaultDurationHours!.Value,
            request.RequiresDaylight,
            isOutdoor ? request.MaxWindMs : null,
            isOutdoor ? request.MaxRainMmPerHour : null,
            isOutdoor ? request.MinTemperatureC : null,
            isOutdoor ? request.MaxTemperatureC : null,
            tags.Tags!));
    }

    private static void AddIfInvalid(Dictionary<string, string> errors, string field, string? message)
    {
        if (message is not null)
        {
            errors[field] = message;
        }
    }
}
