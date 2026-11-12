using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks a plan's setup and activities again with the feature 004 and 005 services before step 3 contacts
/// the weather or map data service (feature 006 FR-004 and FR-005, feature 007 FR-004; research section 2).
/// Shared by the forecast and place requests, so both refuse an out-of-date plan with the same keys:
/// <c>setup</c> when the setup is missing, the setup check's keys prefixed <c>setup.</c>, otherwise the
/// activity check's own keys. The activities are only checked when the setup is valid.
/// </summary>
public sealed class PlanRecheckService(PlanSetupService planSetupService, PlanActivityService planActivityService)
{
    public const string SetupKey = "setup";
    public const string MissingSetupMessage = "The request is invalid.";

    public async Task<PlanRecheckResult> CheckAsync(
        PlanSetupCheckRequest? setupRequest,
        List<PlanActivityRequest>? activityRequests,
        CancellationToken cancellationToken)
    {
        if (setupRequest is null)
        {
            return PlanRecheckResult.Invalid([new(SetupKey, MissingSetupMessage)]);
        }

        var setup = await planSetupService.CheckAsync(setupRequest, cancellationToken);
        if (!setup.Succeeded)
        {
            return PlanRecheckResult.Invalid(
                setup.Errors.Select(error => new KeyValuePair<string, string>($"{SetupKey}.{error.Key}", error.Value)).ToList());
        }

        var activities = await planActivityService.CheckAsync(
            new PlanActivitiesCheckRequest(activityRequests),
            cancellationToken);
        if (!activities.Succeeded)
        {
            return PlanRecheckResult.Invalid(activities.Errors);
        }

        return PlanRecheckResult.Success(setup.Setup, activities.Activities);
    }
}
