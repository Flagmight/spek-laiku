using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The rules for the plan's activities (research section 4, data-model.md Validation rules). It has no
/// database access: <c>PlanActivityService</c> loads the categories and passes them in. The ranges and
/// their messages are in <c>ActivityLimitRules</c>. Messages have no "Error: " prefix; the page adds it.
/// </summary>
public static class PlanActivityValidator
{
    /// <summary>The only copy of the limit; the categories endpoint sends it to the page.</summary>
    public const int MaxActivities = 10;

    public const string NoActivitiesMessage = "Add at least one activity.";
    public const string TooManyActivitiesMessage = "You can add up to 10 activities.";
    public const string UnavailableMessage = "This activity is no longer available. Remove it.";
    public const string CategoryChangedMessage = "This activity's category has changed. Remove it and add it again.";

    /// <summary>A count error stops every other check, so a very long list causes no further work.</summary>
    public static bool HasValidCount(PlanActivitiesCheckRequest request, out KeyValuePair<string, string>? error)
    {
        var count = request.Activities?.Count ?? 0;
        error = count switch
        {
            0 => new("activities", NoActivitiesMessage),
            > MaxActivities => new("activities", TooManyActivitiesMessage),
            _ => null
        };

        return error is null;
    }

    /// <summary>Call only after <see cref="HasValidCount"/> has accepted the request.</summary>
    public static PlanActivitiesResult Validate(
        PlanActivitiesCheckRequest request,
        IReadOnlyDictionary<Guid, ActivityCategory> categories)
    {
        var activities = request.Activities!;
        var errors = new List<KeyValuePair<string, string>>();

        for (var index = 0; index < activities.Count; index++)
        {
            var activity = activities[index];
            var key = $"activities[{index}]";

            // "?." because a JSON list can contain null, which has no category either.
            if (activity?.CategoryId is not { } categoryId || !categories.TryGetValue(categoryId, out var category))
            {
                errors.Add(new(key, UnavailableMessage));
            }
            else if (activity.Type != category.Type.ToString())
            {
                errors.Add(new(key, CategoryChangedMessage));
            }
            else
            {
                AddFieldErrors(errors, key, activity, category.Type);
            }
        }

        return errors.Count > 0
            ? PlanActivitiesResult.Invalid(errors)
            : PlanActivitiesResult.Success(
                activities.Select(activity => ToChecked(activity, categories[activity.CategoryId!.Value])).ToList());
    }

    private static void AddFieldErrors(
        List<KeyValuePair<string, string>> errors,
        string key,
        PlanActivityRequest activity,
        ActivityType type)
    {
        AddIfInvalid(errors, $"{key}.durationHours", ActivityLimitRules.CheckDuration(activity.DurationHours));

        // The weather limits apply only to Outdoor; for Indoor they are ignored whatever the request contains.
        if (type != ActivityType.Outdoor)
        {
            return;
        }

        AddIfInvalid(errors, $"{key}.maxWindMs", ActivityLimitRules.CheckMaxWind(activity.MaxWindMs));
        AddIfInvalid(errors, $"{key}.maxRainMmPerHour", ActivityLimitRules.CheckMaxRain(activity.MaxRainMmPerHour));

        var minError = ActivityLimitRules.CheckMinTemperature(activity.MinTemperatureC);
        var maxError = ActivityLimitRules.CheckMaxTemperature(activity.MaxTemperatureC);
        if (minError is null && maxError is null)
        {
            // Both are valid on their own, so the order can be compared.
            minError = ActivityLimitRules.CheckTemperatureOrder(
                activity.MinTemperatureC!.Value, activity.MaxTemperatureC!.Value);
        }

        AddIfInvalid(errors, $"{key}.minTemperatureC", minError);
        AddIfInvalid(errors, $"{key}.maxTemperatureC", maxError);
    }

    // The name and type come from the stored category; only the plan's own values come from the request.
    private static CheckedPlanActivity ToChecked(PlanActivityRequest activity, ActivityCategory category)
    {
        var isOutdoor = category.Type == ActivityType.Outdoor;
        return new CheckedPlanActivity(
            category.Id,
            category.Name,
            category.Type,
            activity.DurationHours!.Value,
            activity.RequiresDaylight,
            isOutdoor ? activity.MaxWindMs : null,
            isOutdoor ? activity.MaxRainMmPerHour : null,
            isOutdoor ? activity.MinTemperatureC : null,
            isOutdoor ? activity.MaxTemperatureC : null);
    }

    private static void AddIfInvalid(List<KeyValuePair<string, string>> errors, string key, string? message)
    {
        if (message is not null)
        {
            errors.Add(new(key, message));
        }
    }
}
