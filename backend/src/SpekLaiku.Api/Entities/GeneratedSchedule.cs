using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Entities;

/// <summary>
/// A schedule the system generated, remembered for 30 minutes so it can be saved exactly as shown (feature 010
/// spec FR-004). It belongs to no account; its unguessable <see cref="Id"/> is the browser's reference to it.
/// </summary>
public class GeneratedSchedule
{
    public Guid Id { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public PlanSnapshot Snapshot { get; set; } = null!;
}
