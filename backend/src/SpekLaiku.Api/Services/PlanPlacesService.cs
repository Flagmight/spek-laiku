using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The places for a plan (spec FR-004 to FR-007, FR-012; data-model.md PlanPlacesService). The setup and the
/// activities are checked again before the map data service is contacted. The position comes from the location
/// search service and each category's tags from the database, never from the request. The radius is the plan's
/// maximum travel distance, capped by <see cref="PlacesOptions.MaxRadiusKm"/>.
/// </summary>
public sealed class PlanPlacesService(
    PlanRecheckService planRecheckService,
    ApplicationDbContext context,
    NearbyPlacesService nearbyPlacesService,
    IOptions<PlacesOptions> options)
{
    public async Task<PlanPlacesResult> GetAsync(PlanPlacesRequest request, CancellationToken cancellationToken)
    {
        var plan = await planRecheckService.CheckAsync(request.Setup, request.Activities, cancellationToken);
        if (!plan.Succeeded)
        {
            return PlanPlacesResult.Invalid(plan.Errors);
        }

        // Activities of the same category share one search and one list of places (spec FR-005).
        var categoryIds = plan.Activities.Select(activity => activity.CategoryId).Distinct().ToList();
        var storedTags = await context.ActivityCategories
            .AsNoTracking()
            .Where(category => categoryIds.Contains(category.Id))
            .Select(category => new { category.Id, category.PlaceTags })
            .ToDictionaryAsync(category => category.Id, category => category.PlaceTags, cancellationToken);

        // A category removed since the check has no tags, so it gets no places.
        var categories = categoryIds
            .Select(id => new CategoryTags(id, storedTags.TryGetValue(id, out var tags) ? tags : []))
            .ToList();
        var radiusKm = Math.Min(plan.Setup.MaxTravelDistanceKm, options.Value.MaxRadiusKm);

        var received = await nearbyPlacesService.GetAsync(plan.Setup.Location, radiusKm, categories, cancellationToken);

        // The oldest receive time, so the message never makes older places look newer (Clarifications).
        var updatedAt = ForecastPeriod.ToLithuanianMinute(received.Min(places => places.ReceivedAt));
        var categoryPlaces = categories
            .Select((category, index) => new CategoryPlaces(category.CategoryId, received[index].Places))
            .ToList();

        return PlanPlacesResult.Success(new PlanPlaces(updatedAt, radiusKm, categoryPlaces));
    }
}
