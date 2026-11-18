namespace SpekLaiku.Api.Services;

/// <summary>
/// The rules and messages for saving a plan (feature 010 spec FR-002, data-model.md "Save request"). The name
/// is checked here without database access; the generated schedule checks are in <see cref="SavedPlanService"/>.
/// </summary>
public static class SavedPlanValidator
{
    public const string NameKey = "name";
    public const string ScheduleKey = "generatedScheduleId";
    public const int MaxNameLength = 80;

    public const string NameRequiredMessage = "Enter a plan name.";
    public const string NameTooLongMessage = "Plan name can be at most 80 characters.";
    public const string ScheduleExpiredMessage = "Generate the schedule again to save it.";
    public const string NothingToSaveMessage = "There is nothing to save in this schedule.";

    /// <summary>
    /// The trimmed name, or the error: required and not only spaces, then at most 80 characters after trimming.
    /// </summary>
    public static (string? TrimmedName, KeyValuePair<string, string>? Error) CheckName(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return (null, new(NameKey, NameRequiredMessage));
        }

        return trimmed.Length > MaxNameLength ? (null, new(NameKey, NameTooLongMessage)) : (trimmed, null);
    }
}
