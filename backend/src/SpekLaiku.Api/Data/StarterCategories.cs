using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Data;

// The starter categories that the AddActivityCategories migration inserts once at first setup
// (spec FR-025, research section 5). These values MUST NOT be changed, and no later migration may
// change them: the migration reads them, and after setup a starter category belongs to the
// administrators, who may edit or rename it.
public static class StarterCategories
{
    public static readonly Guid CyclingId = new("3f1c2a5e-8b4d-4c61-9a0e-1d2b3c4d5e01");
    public static readonly Guid KayakingId = new("3f1c2a5e-8b4d-4c61-9a0e-1d2b3c4d5e02");
    public static readonly Guid PicnicId = new("3f1c2a5e-8b4d-4c61-9a0e-1d2b3c4d5e03");
    public static readonly Guid HeritageSiteId = new("3f1c2a5e-8b4d-4c61-9a0e-1d2b3c4d5e04");
    public static readonly Guid MuseumId = new("3f1c2a5e-8b4d-4c61-9a0e-1d2b3c4d5e05");

    public static IReadOnlyList<ActivityCategory> All { get; } =
    [
        new()
        {
            Id = CyclingId,
            Name = "Cycling",
            NormalizedName = "CYCLING",
            Type = ActivityType.Outdoor,
            DefaultDurationHours = 2.0m,
            RequiresDaylight = true,
            MaxWindMs = 10.0m,
            MaxRainMmPerHour = 1.0m,
            MinTemperatureC = 5.0m,
            MaxTemperatureC = 32.0m,
            PlaceTags = ["highway=cycleway", "route=bicycle"]
        },
        new()
        {
            Id = KayakingId,
            Name = "Kayaking",
            NormalizedName = "KAYAKING",
            Type = ActivityType.Outdoor,
            DefaultDurationHours = 2.0m,
            RequiresDaylight = true,
            MaxWindMs = 8.0m,
            MaxRainMmPerHour = 0.5m,
            MinTemperatureC = 15.0m,
            MaxTemperatureC = 35.0m,
            PlaceTags = ["leisure=slipway", "sport=canoe"]
        },
        new()
        {
            Id = PicnicId,
            Name = "Picnic",
            NormalizedName = "PICNIC",
            Type = ActivityType.Outdoor,
            DefaultDurationHours = 1.5m,
            RequiresDaylight = true,
            MaxWindMs = 8.0m,
            MaxRainMmPerHour = 0.0m,
            MinTemperatureC = 15.0m,
            MaxTemperatureC = 32.0m,
            PlaceTags = ["tourism=picnic_site", "leisure=picnic_table"]
        },
        new()
        {
            Id = HeritageSiteId,
            Name = "Heritage site",
            NormalizedName = "HERITAGE SITE",
            Type = ActivityType.Outdoor,
            DefaultDurationHours = 1.5m,
            RequiresDaylight = true,
            MaxWindMs = 15.0m,
            MaxRainMmPerHour = 2.0m,
            MinTemperatureC = 0.0m,
            MaxTemperatureC = 35.0m,
            PlaceTags = ["historic=castle", "historic=manor", "historic=monument", "historic=archaeological_site"]
        },
        new()
        {
            Id = MuseumId,
            Name = "Museum",
            NormalizedName = "MUSEUM",
            Type = ActivityType.Indoor,
            DefaultDurationHours = 2.0m,
            RequiresDaylight = false,
            MaxWindMs = null,
            MaxRainMmPerHour = null,
            MinTemperatureC = null,
            MaxTemperatureC = null,
            PlaceTags = ["tourism=museum"]
        }
    ];
}
