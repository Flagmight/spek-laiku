using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Generates the schedule for a checked plan (spec FR-002, FR-003, research section 8). The setup and the
/// activities are checked again before the weather and map data services are contacted. The forecast and
/// places are fetched from their caches, so both services are only called when the cache is stale. After the
/// time slots are assigned, the travel check chooses the places and the trips between consecutive activities
/// against the plan's maximum travel distance (feature 009 spec FR-001 to FR-006, research section 4). A schedule
/// with at least one scheduled activity is remembered for 30 minutes so it can be saved (feature 010 FR-004). The
/// location lookup, the forecast and the map data search together end within <see cref="RequestDeadline.Limit"/>; when
/// the first two use up the time, the map data is not contacted and the request fails as a map data failure
/// (feature 017 spec FR-007).
/// </summary>
public sealed class PlanScheduleService(
    PlanRecheckService planRecheckService,
    WeatherForecastService weatherForecastService,
    ApplicationDbContext context,
    NearbyPlacesService nearbyPlacesService,
    GeneratedScheduleService generatedScheduleService,
    ForecastPeriod forecastPeriod,
    IOptions<ForecastOptions> forecastOptions,
    IOptions<PlacesOptions> placesOptions)
{
    public async Task<PlanScheduleResult> GetAsync(PlanScheduleRequest request, CancellationToken cancellationToken)
    {
        // First, so the location lookup and the forecast are inside the 9-second limit too (feature 017 spec FR-007).
        var deadline = RequestDeadline.Start(forecastPeriod);
        var plan = await planRecheckService.CheckAsync(request.Setup, request.Activities, cancellationToken);
        if (!plan.Succeeded)
        {
            return PlanScheduleResult.Invalid(plan.Errors);
        }

        var received = await weatherForecastService.GetAsync(plan.Setup.Location, cancellationToken);

        if (plan.Setup.Dates.Any(date => received.Data.Days.All(day => day.Date != date)))
        {
            return PlanScheduleResult.Invalid(
                [new($"{PlanRecheckService.SetupKey}.dates", PlanSetupValidator.PastDateMessage)]);
        }

        var days = PlanningDays.Build(received.Data, plan.Setup.Dates, forecastPeriod.GetNow(), forecastOptions.Value);

        var categoryIds = plan.Activities.Select(activity => activity.CategoryId).Distinct().ToList();
        var storedTags = await context.ActivityCategories
            .AsNoTracking()
            .Where(category => categoryIds.Contains(category.Id))
            .Select(category => new { category.Id, category.PlaceTags })
            .ToDictionaryAsync(category => category.Id, category => category.PlaceTags, cancellationToken);

        var categories = categoryIds
            .Select(id => new CategoryTags(id, storedTags.TryGetValue(id, out var tags) ? tags : []))
            .ToList();
        var radiusKm = Math.Min(plan.Setup.MaxTravelDistanceKm, placesOptions.Value.MaxRadiusKm);

        var received2 = await nearbyPlacesService.GetAsync(
            plan.Setup.Location, radiusKm, categories, deadline, cancellationToken);
        var categoryPlaces = categories
            .Select((category, index) => new CategoryPlaces(category.CategoryId, received2[index].Places))
            .ToList();

        var forecasts = plan.Activities.Select(activity => ActivityForecasts.For(activity, days)).ToList();
        var (scheduled, unscheduled) = PlanScheduler.Assign(plan.Activities, forecasts, categoryPlaces, days);

        var (withTravel, travel) = TravelDistanceRules.Apply(
            scheduled, categoryPlaces, plan.Setup.MaxTravelDistanceKm);

        var schedule = new PlanSchedule(withTravel, unscheduled, travel);
        Guid? generatedScheduleId = schedule.Scheduled.Count > 0
            ? await generatedScheduleService.RememberAsync(
                new PlanSnapshot(plan.Setup, plan.Activities, schedule), cancellationToken)
            : null;

        return PlanScheduleResult.Success(schedule, generatedScheduleId);
    }
}
