using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// A failed write must not turn a computed schedule into an error: the schedule is still shown, it only cannot
/// be saved (feature 010 code review). The expiry rules are covered by the integration tests against PostgreSQL.
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

    public void Dispose()
    {
        loggerFactory.Dispose();
        logs.Dispose();
    }
}
