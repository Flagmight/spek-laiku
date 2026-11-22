using Microsoft.Extensions.Options;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks one saved plan against the latest forecast (feature 012 spec FR-001, FR-002, FR-004, FR-012, FR-014;
/// research sections 3, 8 and 9). The owner check comes first, so a refused request never reaches the weather
/// service. Everything the check needs comes from the saved plan. The plan is read with <c>AsNoTracking</c> and
/// never saved, so a check cannot change it. A plan whose activities have all started is not checked, and the
/// weather service is not asked. Otherwise the forecast comes through the shared cache, at most 30 minutes old.
/// A weather service failure is not caught here: it reaches <c>ApiExceptionHandler</c>, which answers 503.
/// </summary>
public sealed class PlanCheckService(
    SavedPlanService savedPlanService,
    WeatherForecastService weatherForecastService,
    ForecastPeriod forecastPeriod,
    IOptions<ForecastOptions> options)
{
    public async Task<PlanCheckResult> CheckAsync(string ownerId, Guid id, CancellationToken cancellationToken)
    {
        var lookup = await savedPlanService.GetAsync(ownerId, id, cancellationToken);
        if (!lookup.Found)
        {
            return lookup.IsForbidden ? PlanCheckResult.Forbidden : PlanCheckResult.NotFound;
        }

        var plan = lookup.Plan;
        var snapshot = plan.Snapshot;
        var now = forecastPeriod.GetNow();

        // Every activity has started: nothing is checked and the weather service is not asked (spec FR-006, SC-005).
        if (snapshot.Schedule.Scheduled.All(entry => PlanCheckRules.HasStarted(entry, now)))
        {
            return PlanCheckResult.Of(new PlanCheck(
                plan.SavedAtUtc,
                AllPast: true,
                ForecastUpdatedAt: null,
                PlanCheckRules.Check(snapshot, [], now)));
        }

        var received = await weatherForecastService.GetAsync(snapshot.Setup.Location, cancellationToken);

        // Midnight can pass while the forecast is fetched; a date the answer does not cover has then started, and
        // its activities are past (research section 8).
        var dates = snapshot.Schedule.Scheduled
            .Where(entry => !PlanCheckRules.HasStarted(entry, now))
            .Select(entry => entry.Date)
            .Where(date => received.Data.Days.Any(day => day.Date == date))
            .Distinct()
            .ToList();
        var days = PlanningDays.Build(received.Data, dates, now, options.Value);

        return PlanCheckResult.Of(new PlanCheck(
            plan.SavedAtUtc,
            AllPast: false,
            ForecastPeriod.ToLithuanianMinute(received.ReceivedAt),
            PlanCheckRules.Check(snapshot, days, now)));
    }
}
