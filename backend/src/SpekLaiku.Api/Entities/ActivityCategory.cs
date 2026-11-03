namespace SpekLaiku.Api.Entities;

public class ActivityCategory
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public ActivityType Type { get; set; }
    public decimal DefaultDurationHours { get; set; }
    public bool RequiresDaylight { get; set; }
    public decimal? MaxWindMs { get; set; }
    public decimal? MaxRainMmPerHour { get; set; }
    public decimal? MinTemperatureC { get; set; }
    public decimal? MaxTemperatureC { get; set; }
    public List<string> PlaceTags { get; set; } = [];

    // Maps to the PostgreSQL xmin system column; it changes on every update.
    public uint Version { get; set; }
}
