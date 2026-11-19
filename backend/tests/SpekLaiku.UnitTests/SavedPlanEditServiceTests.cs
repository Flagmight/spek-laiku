using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// A plan deleted by another request after the ownership check, but before the change is saved, counts as not
/// found, as for a delete (feature 011 code review). The in-memory provider reports the missing row the same way
/// PostgreSQL does through EF Core: with a concurrency exception.
/// </summary>
public sealed class SavedPlanEditServiceTests
{
    private const string OwnerId = "owner-1";

    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-10T12:20:00Z");

    [Fact]
    public async Task RenamingAPlanDeletedMeanwhile_IsNotFound()
    {
        var (service, planId) = await CreateServiceWithAPlanDeletedOnSaveAsync();

        var change = await service.RenameAsync(OwnerId, planId, new RenamePlanRequest("Trip"), CancellationToken.None);

        Assert.Equal(SavedPlanChangeOutcome.NotFound, change.Outcome);
    }

    [Fact]
    public async Task SavingChangesToAPlanDeletedMeanwhile_IsNotFound()
    {
        var (service, planId) = await CreateServiceWithAPlanDeletedOnSaveAsync(rememberSchedule: true);

        var change = await service.ReplaceAsync(
            OwnerId,
            planId,
            new SavePlanRequest(RememberedScheduleId, "Trip"),
            CancellationToken.None);

        Assert.Equal(SavedPlanChangeOutcome.NotFound, change.Outcome);
    }

    private static readonly Guid RememberedScheduleId = Guid.NewGuid();

    // The service's context deletes the plan through a second context just before its own save, as a delete
    // request that commits between the ownership check and the save would.
    private static async Task<(SavedPlanEditService Service, Guid PlanId)> CreateServiceWithAPlanDeletedOnSaveAsync(
        bool rememberSchedule = false)
    {
        var databaseName = Guid.NewGuid().ToString();
        var planId = Guid.NewGuid();
        await using (var setup = CreateContext(databaseName))
        {
            var snapshot = PlanSnapshotJsonTests.CreateSnapshot();
            setup.SavedPlans.Add(new SavedPlan
            {
                Id = planId,
                OwnerId = OwnerId,
                Name = "Weekend",
                SavedAtUtc = Now.UtcDateTime,
                CreatedAtUtc = Now.UtcDateTime,
                LocationName = "Kaunas",
                Dates = [.. snapshot.Setup.Dates],
                Snapshot = snapshot
            });
            if (rememberSchedule)
            {
                setup.GeneratedSchedules.Add(new GeneratedSchedule
                {
                    Id = RememberedScheduleId,
                    CreatedAtUtc = Now.UtcDateTime,
                    ExpiresAtUtc = Now.UtcDateTime.AddMinutes(30),
                    Snapshot = snapshot
                });
            }

            await setup.SaveChangesAsync();
        }

        var context = CreateContext(databaseName, new DeleteBeforeSave(databaseName, planId));
        var clock = new FixedTimeProvider(Now);
        var generatedSchedules = new GeneratedScheduleService(
            context,
            clock,
            NullLogger<GeneratedScheduleService>.Instance);
        return (new SavedPlanEditService(context, generatedSchedules, clock), planId);
    }

    private static ApplicationDbContext CreateContext(string databaseName, params IInterceptor[] interceptors) =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName)
            .AddInterceptors(interceptors)
            .Options);

    private sealed class DeleteBeforeSave(string databaseName, Guid planId) : SaveChangesInterceptor
    {
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            await using var other = CreateContext(databaseName);
            other.SavedPlans.Remove(await other.SavedPlans.SingleAsync(plan => plan.Id == planId, cancellationToken));
            await other.SaveChangesAsync(cancellationToken);
            return result;
        }
    }
}
