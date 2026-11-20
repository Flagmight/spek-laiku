using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Inserts saved plans directly, with a hand-built snapshot, for the plan check tests (feature 012 research section
/// 16). Each test can then build the exact schedule it needs, and the map data service is never involved. Every
/// plan should use its own <see cref="NewLocation"/>: the forecast cache is keyed by location id and the fake
/// weather service by position, so tests never see each other's forecasts.
/// </summary>
internal sealed class SavedPlanSeed(PostgreSqlApiFactory factory)
{
    /// <summary>The saved and created time of every seeded plan: the day before <see cref="ScheduleScenario.Now"/>.</summary>
    public static readonly DateTime SavedAtUtc = new(2026, 11, 9, 10, 0, 0, DateTimeKind.Utc);

    /// <summary>Today at <see cref="ScheduleScenario.Now"/> (14:20 in Vilnius), the first forecast date.</summary>
    public static readonly DateOnly Today = new(2026, 11, 10);

    /// <summary>Two days after <see cref="Today"/>, as in <see cref="ScheduleScenario.PlanDate"/>.</summary>
    public static readonly DateOnly PlanDate = new(2026, 11, 12);

    public static readonly TimeOnly Sunrise = new(7, 30);
    public static readonly TimeOnly Sunset = new(16, 30);

    /// <summary>
    /// The whole forecast period from <see cref="Today"/>: 10 °C, no rain and <paramref name="wind"/> m/s every
    /// hour, with <see cref="Sunrise"/> and <see cref="Sunset"/> every day.
    /// </summary>
    public static HourlyForecast CalmForecast(double wind = 5.0) =>
        FakeForecastClient.Fill(Today, ForecastPeriod.Days, 10.0, 0.0, wind, Sunrise, Sunset);

    /// <summary>Sends <c>GET /api/plans/{id}/check</c> and returns the status and the parsed body, if any.</summary>
    public static async Task<(HttpStatusCode Status, JsonElement Body)> CheckAsync(HttpClient client, Guid id) =>
        await CheckAsync(client, id.ToString());

    public static async Task<(HttpStatusCode Status, JsonElement Body)> CheckAsync(HttpClient client, string id)
    {
        using var response = await client.GetAsync($"/api/plans/{id}/check");
        var text = await response.Content.ReadAsStringAsync();
        if (string.IsNullOrEmpty(text))
        {
            return (response.StatusCode, default);
        }

        using var document = JsonDocument.Parse(text);
        return (response.StatusCode, document.RootElement.Clone());
    }

    private const int FirstLocationId = 900000;

    private static int lastLocationId = FirstLocationId;

    /// <summary>A location no other test uses: its own id and its own position.</summary>
    public static PlaceLocation NewLocation()
    {
        var id = Interlocked.Increment(ref lastLocationId);
        return new PlaceLocation(id, $"Seeded place {id}", "Kaunas County", 55.0 + (id - FirstLocationId) * 0.001, 24.0);
    }

    public static CheckedPlanActivity Outdoor(
        string name,
        Guid categoryId,
        decimal maxWind = 8,
        decimal maxRain = 1,
        decimal minTemperature = 0,
        decimal maxTemperature = 30,
        bool requiresDaylight = true,
        decimal durationHours = 2) =>
        new(categoryId, name, ActivityType.Outdoor, durationHours, requiresDaylight, maxWind, maxRain, minTemperature, maxTemperature);

    public static CheckedPlanActivity Indoor(
        string name,
        Guid categoryId,
        bool requiresDaylight = false,
        decimal durationHours = 2) =>
        new(categoryId, name, ActivityType.Indoor, durationHours, requiresDaylight, null, null, null, null);

    /// <summary>
    /// One scheduled entry of <paramref name="activity"/>, which is the plan's activity number
    /// <paramref name="activityIndex"/>. Its saved weather is a fixed value, so a test can tell it from the latest.
    /// </summary>
    public static ScheduledActivity Entry(
        int activityIndex,
        CheckedPlanActivity activity,
        DateOnly date,
        TimeOnly start,
        TimeOnly end,
        NearbyPlace? place = null,
        TravelLeg? travel = null) =>
        new(
            activity.CategoryId,
            activity.Name,
            date,
            start,
            end,
            place ?? new NearbyPlace($"{activity.Name} place", 55.0, 24.0, 1.0m, "Kaunas", $"node/{activityIndex}"),
            ActivityForecasts.IsWeatherIndependent(activity)
                ? new WeatherSnapshot(null, null, null, IsIndoor: true)
                : new WeatherSnapshot(1m, 0m, 1m, IsIndoor: false),
            travel,
            activityIndex);

    /// <summary>Writes a saved plan owned by <paramref name="ownerId"/> and returns its id.</summary>
    public async Task<Guid> InsertAsync(
        string ownerId,
        PlaceLocation location,
        IReadOnlyList<DateOnly> dates,
        IReadOnlyList<CheckedPlanActivity> activities,
        IReadOnlyList<ScheduledActivity> scheduled,
        int maxDistanceKm = 30,
        string name = "Seeded plan")
    {
        var snapshot = new PlanSnapshot(
            new CheckedPlanSetup(location, dates, maxDistanceKm),
            activities,
            new PlanSchedule(
                scheduled,
                [],
                new TravelSummary(maxDistanceKm, scheduled.Count(entry => entry.Travel?.OverLimit == true))));
        var plan = new SavedPlan
        {
            Id = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = name,
            SavedAtUtc = SavedAtUtc,
            CreatedAtUtc = SavedAtUtc,
            LocationName = location.Name,
            Dates = dates.ToList(),
            GeneratedScheduleId = null,
            Snapshot = snapshot
        };

        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        context.SavedPlans.Add(plan);
        await context.SaveChangesAsync();
        return plan.Id;
    }

    /// <summary>The stored snapshot exactly as written, for the "plan unchanged" tests.</summary>
    public async Task<string> SnapshotJsonAsync(Guid id)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = await context.SavedPlans.AsNoTracking().SingleAsync(saved => saved.Id == id);
        return JsonSerializer.Serialize(plan.Snapshot, PlanSnapshotConversion.JsonOptions);
    }
}
