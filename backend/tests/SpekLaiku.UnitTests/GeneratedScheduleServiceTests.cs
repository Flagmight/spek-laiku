using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// A failed write must not turn a computed schedule into an error: the schedule is still shown, it only cannot
/// be saved (feature 010 code review). The expiry rules are covered by the integration tests against PostgreSQL;
/// here the shared savable-schedule checks run against the in-memory provider (feature 011).
/// </summary>
public sealed class GeneratedScheduleServiceTests : IDisposable
{
    private readonly CapturingLoggerProvider logs = new();
    private readonly ILoggerFactory loggerFactory;

    public GeneratedScheduleServiceTests()
    {
        loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(logs));
    }

    [Fact]
    public async Task DatabaseThatCannotStoreTheSchedule_GivesNoIdAndLogsOnlyTheKindOfFailure()
    {
        // The in-memory provider cannot run ExecuteDeleteAsync, which stands in for a failing database write.
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var context = new ApplicationDbContext(options);
        var service = new GeneratedScheduleService(
            context,
            new FixedTimeProvider(DateTimeOffset.Parse("2026-11-10T12:20:00Z")),
            loggerFactory.CreateLogger<GeneratedScheduleService>());

        var id = await service.RememberAsync(PlanSnapshotJsonTests.CreateSnapshot(), CancellationToken.None);

        Assert.Null(id);
        var warning = Assert.Single(logs.Entries, entry => entry.Contains("Warning"));
        Assert.Contains("could not be stored", warning);
        Assert.DoesNotContain("Kaunas", warning);
        Assert.DoesNotContain("Cycling", warning);
        Assert.Empty(context.ChangeTracker.Entries());
    }

    // Feature 011 research section 3: the checks that decide whether a generated schedule can be saved, shared by
    // saving a new plan and saving changes.
    [Fact]
    public async Task FindSavable_ReturnsARememberedScheduleWithSomethingScheduled()
    {
        await using var context = CreateContext();
        var snapshot = PlanSnapshotJsonTests.CreateSnapshot();
        var id = Remember(context, snapshot, expiresAt: Now.AddMinutes(30));

        var (found, error) = await CreateService(context).FindSavableAsync(id, CancellationToken.None);

        // The stored JSON is read back as a new object, so it is compared by content.
        Assert.NotNull(found);
        Assert.Equal(JsonSerializer.Serialize(snapshot), JsonSerializer.Serialize(found));
        Assert.Null(error);
    }

    [Fact]
    public async Task FindSavable_RefusesAMissingUnknownOrExpiredId()
    {
        await using var context = CreateContext();
        var expired = Remember(context, PlanSnapshotJsonTests.CreateSnapshot(), expiresAt: Now);
        var service = CreateService(context);
        var expected = new KeyValuePair<string, string>(
            "generatedScheduleId",
            "Generate the schedule again to save it.");

        foreach (var id in new Guid?[] { null, Guid.NewGuid(), expired })
        {
            var (found, error) = await service.FindSavableAsync(id, CancellationToken.None);

            Assert.Null(found);
            Assert.Equal(expected, error);
        }
    }

    [Fact]
    public async Task FindSavable_RefusesAScheduleWithNothingScheduled()
    {
        await using var context = CreateContext();
        var snapshot = PlanSnapshotJsonTests.CreateSnapshot();
        var empty = snapshot with { Schedule = snapshot.Schedule with { Scheduled = [] } };
        var id = Remember(context, empty, expiresAt: Now.AddMinutes(30));

        var (found, error) = await CreateService(context).FindSavableAsync(id, CancellationToken.None);

        Assert.Null(found);
        Assert.Equal(
            new KeyValuePair<string, string>("generatedScheduleId", "There is nothing to save in this schedule."),
            error);
    }

    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-10T12:20:00Z");

    private static ApplicationDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private GeneratedScheduleService CreateService(ApplicationDbContext context) =>
        new(context, new FixedTimeProvider(Now), loggerFactory.CreateLogger<GeneratedScheduleService>());

    private static Guid Remember(ApplicationDbContext context, PlanSnapshot snapshot, DateTimeOffset expiresAt)
    {
        var id = Guid.NewGuid();
        context.GeneratedSchedules.Add(new GeneratedSchedule
        {
            Id = id,
            CreatedAtUtc = expiresAt.UtcDateTime.AddMinutes(-30),
            ExpiresAtUtc = expiresAt.UtcDateTime,
            Snapshot = snapshot
        });
        context.SaveChanges();
        return id;
    }

    public void Dispose()
    {
        loggerFactory.Dispose();
        logs.Dispose();
    }
}
