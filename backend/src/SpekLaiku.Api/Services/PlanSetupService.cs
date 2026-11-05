using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks a plan setup on Continue (spec FR-012): the rules in <see cref="PlanSetupValidator"/> against
/// today's forecast period, and the place looked up again by its id, so the request cannot invent a
/// place or move one into Lithuania. Every failing field is reported together, in contract order.
/// </summary>
public sealed class PlanSetupService(LocationSearchService locationSearchService, ForecastPeriod forecastPeriod)
{
    public async Task<PlanSetupResult> CheckAsync(PlanSetupCheckRequest request, CancellationToken cancellationToken)
    {
        var (firstDate, lastDate) = forecastPeriod.GetCurrent();
        var validation = PlanSetupValidator.Validate(request, firstDate, lastDate);

        // A missing or non-positive id is already reported by the validator and is not looked up.
        PlaceLocation? place = null;
        var errors = new List<KeyValuePair<string, string>>();
        if (request.LocationId is { } locationId && locationId > 0)
        {
            place = await locationSearchService.FindAsync(locationId, cancellationToken);
            if (place is null)
            {
                errors.Add(new("locationId", PlanSetupValidator.LocationMessage));
            }
        }

        errors.AddRange(validation.Errors);
        if (errors.Count > 0 || place is null)
        {
            return PlanSetupResult.Invalid(errors);
        }

        return PlanSetupResult.Success(new CheckedPlanSetup(place, validation.Dates, validation.MaxTravelDistanceKm));
    }
}
