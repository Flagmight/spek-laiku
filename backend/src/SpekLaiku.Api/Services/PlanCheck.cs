namespace SpekLaiku.Api.Services;

/// <summary>
/// The result of checking one saved plan against the latest forecast (feature 012 data-model.md PlanCheck). It is
/// never stored. <see cref="Entries"/> has one entry per scheduled activity of the saved plan, in the stored order.
/// <see cref="AllPast"/> holds exactly when every entry is past, and then <see cref="ForecastUpdatedAt"/> is
/// <c>null</c> because no forecast was used.
/// </summary>
public sealed record PlanCheck(
    DateTime SavedAt,
    bool AllPast,
    TimeOnly? ForecastUpdatedAt,
    IReadOnlyList<PlanCheckEntry> Entries);
