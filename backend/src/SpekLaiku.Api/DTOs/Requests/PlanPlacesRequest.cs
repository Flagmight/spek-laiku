namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>
/// What step 3 sends for the places (contracts/plan-places-api.md): the same body as the forecast request,
/// the checked setup and activities, so the server checks both again (research section 1). No map place tag
/// is read from it.
/// </summary>
public sealed record PlanPlacesRequest(PlanSetupCheckRequest? Setup, List<PlanActivityRequest>? Activities);
