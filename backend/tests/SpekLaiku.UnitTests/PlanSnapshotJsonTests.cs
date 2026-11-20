using System.Text.Json;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The schedule records are a storage format for saved plans (feature 010 research section 4, Risk): a full
/// snapshot must be written and read back unchanged, with enums stored by name.
/// </summary>
public sealed class PlanSnapshotJsonTests
{
    [Fact]
    public void FullSnapshot_IsReadBackUnchanged()
    {
        var snapshot = CreateSnapshot();

        var json = JsonSerializer.Serialize(snapshot, PlanSnapshotConversion.JsonOptions);
        var read = JsonSerializer.Deserialize<PlanSnapshot>(json, PlanSnapshotConversion.JsonOptions)!;

        Assert.Equal(snapshot.Setup.Location, read.Setup.Location);
        Assert.Equal(snapshot.Setup.Dates, read.Setup.Dates);
        Assert.Equal(snapshot.Setup.MaxTravelDistanceKm, read.Setup.MaxTravelDistanceKm);
        Assert.Equal(snapshot.Activities, read.Activities);
        Assert.Equal(snapshot.Schedule.Scheduled, read.Schedule.Scheduled);
        Assert.Equal(snapshot.Schedule.Unscheduled, read.Schedule.Unscheduled);
        Assert.Equal(snapshot.Schedule.Travel, read.Schedule.Travel);
    }

    [Fact]
    public void Enums_AreStoredByName()
    {
        var json = JsonSerializer.Serialize(CreateSnapshot(), PlanSnapshotConversion.JsonOptions);

        Assert.Contains("\"type\":\"Outdoor\"", json);
        Assert.Contains("\"type\":\"Indoor\"", json);
        Assert.Contains("\"reason\":\"NoPlace\"", json);
        Assert.Contains("\"reason\":\"NoSuitableTime\"", json);
    }

    [Fact]
    public void Converter_WritesAndReadsTheSameJson()
    {
        var snapshot = CreateSnapshot();

        var stored = (string)PlanSnapshotConversion.Converter.ConvertToProvider(snapshot)!;
        var read = (PlanSnapshot)PlanSnapshotConversion.Converter.ConvertFromProvider(stored)!;

        Assert.True(PlanSnapshotConversion.Comparer.Equals(snapshot, read));
    }

    [Fact]
    public void StoredScheduleWithoutActivityIndex_IsReadWithNull()
    {
        // Plans saved before feature 012 have no "activityIndex" key at all (research section 4).
        var json = JsonSerializer.Serialize(CreateSnapshot(), PlanSnapshotConversion.JsonOptions)
            .Replace(",\"activityIndex\":null", string.Empty, StringComparison.Ordinal);
        Assert.DoesNotContain("activityIndex", json);

        var read = JsonSerializer.Deserialize<PlanSnapshot>(json, PlanSnapshotConversion.JsonOptions)!;

        Assert.Equal(2, read.Schedule.Scheduled.Count);
        Assert.All(read.Schedule.Scheduled, entry => Assert.Null(entry.ActivityIndex));
        Assert.NotNull(read.Schedule.Scheduled[1].Travel);
    }

    [Fact]
    public void ActivityIndex_RoundTripsAsActivityIndex()
    {
        var snapshot = CreateSnapshot();
        var withIndex = snapshot with
        {
            Schedule = snapshot.Schedule with
            {
                Scheduled = [.. snapshot.Schedule.Scheduled.Select((entry, index) => entry with { ActivityIndex = index })]
            }
        };

        var json = JsonSerializer.Serialize(withIndex, PlanSnapshotConversion.JsonOptions);
        var read = JsonSerializer.Deserialize<PlanSnapshot>(json, PlanSnapshotConversion.JsonOptions)!;

        Assert.Contains("\"activityIndex\":1", json);
        Assert.Equal([0, 1], read.Schedule.Scheduled.Select(entry => entry.ActivityIndex));
    }

    internal static PlanSnapshot CreateSnapshot()
    {
        var cyclingId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
        var museumId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");
        var firstDate = new DateOnly(2026, 11, 21);
        var secondDate = new DateOnly(2026, 11, 22);
        var path = new NearbyPlace("Nemunas cycle path", 54.8972, 23.8861, 3.4m, "Kaunas", "way/1");
        var museum = new NearbyPlace("Kaunas Castle", 54.89851, 23.88531, 1.2m, null, "node/2");

        return new PlanSnapshot(
            new CheckedPlanSetup(
                new PlaceLocation(598316, "Kaunas", "Kaunas City Municipality", 54.90272, 23.90961),
                [firstDate, secondDate],
                30),
            [
                new CheckedPlanActivity(cyclingId, "Cycling", ActivityType.Outdoor, 2.5m, true, 10m, 1m, 5m, 32m),
                new CheckedPlanActivity(museumId, "Museum", ActivityType.Indoor, 1.5m, false, null, null, null, null)
            ],
            new PlanSchedule(
                [
                    new ScheduledActivity(
                        cyclingId,
                        "Cycling",
                        firstDate,
                        new TimeOnly(10, 0),
                        new TimeOnly(13, 0),
                        path,
                        new WeatherSnapshot(8.5m, 0.0m, 3.2m, IsIndoor: false)),
                    new ScheduledActivity(
                        museumId,
                        "Museum",
                        firstDate,
                        new TimeOnly(14, 0),
                        new TimeOnly(22, 0),
                        museum,
                        new WeatherSnapshot(null, null, null, IsIndoor: true),
                        new TravelLeg("Nemunas cycle path", 1.1m, OverLimit: false))
                ],
                [
                    new UnscheduledActivity("Kayaking", UnscheduledReason.NoPlace),
                    new UnscheduledActivity("Picnic", UnscheduledReason.NoSuitableTime)
                ],
                new TravelSummary(30, 0)));
    }
}
