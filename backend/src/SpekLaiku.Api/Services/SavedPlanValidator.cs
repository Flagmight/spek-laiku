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

    public const string CopyPrefix = "Copy of ";

    /// <summary>The generated schedule error for a missing, unknown, expired or already saved schedule.</summary>
    public static readonly KeyValuePair<string, string> ScheduleExpired = new(ScheduleKey, ScheduleExpiredMessage);

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

    /// <summary>
    /// The name of a copy: "Copy of " and the original name, cut to <see cref="MaxNameLength"/> characters (the
    /// unit <see cref="CheckName"/> counts). A cut that would keep only half of a character made of two UTF-16
    /// units, such as an emoji, drops that half too, and spaces left at the end by the cut are removed, so the name
    /// stays trimmed like every other plan name (feature 011 spec FR-005, research section 6).
    /// </summary>
    public static string CopyName(string original)
    {
        var name = CopyPrefix + original;
        if (name.Length <= MaxNameLength)
        {
            return name;
        }

        var length = char.IsHighSurrogate(name[MaxNameLength - 1]) ? MaxNameLength - 1 : MaxNameLength;
        return name[..length].TrimEnd();
    }
}
