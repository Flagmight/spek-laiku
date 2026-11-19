using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Entities;

/// <summary>
/// A plan kept under one Registered User's account (feature 010 data-model.md). Feature 011 lets its owner rename
/// it, replace it with an edited version, copy it and delete it. <see cref="LocationName"/> and
/// <see cref="Dates"/> are copied from <see cref="Snapshot"/> whenever the snapshot is set, so the lists never
/// load the stored schedule (feature 010 research section 5).
/// </summary>
public class SavedPlan
{
    public Guid Id { get; set; }

    /// <summary>Always the signed-in user who saved it (spec FR-013).</summary>
    public string OwnerId { get; set; } = string.Empty;

    /// <summary>Trimmed, 1 to 80 characters, not unique (spec FR-002).</summary>
    public string Name { get; set; } = string.Empty;

    public DateTime SavedAtUtc { get; set; }

    /// <summary>
    /// When this row was created, by a save or a duplicate; never changed afterwards. Breaks ties on
    /// <see cref="SavedAtUtc"/> so a copy is listed directly above its original (feature 011 research section 5).
    /// </summary>
    public DateTime CreatedAtUtc { get; set; }

    public string LocationName { get; set; } = string.Empty;
    public List<DateOnly> Dates { get; set; } = [];

    /// <summary>The generated schedule it was saved from; unique, so a repeated save creates no second plan.</summary>
    public Guid? GeneratedScheduleId { get; set; }

    public PlanSnapshot Snapshot { get; set; } = null!;
}
