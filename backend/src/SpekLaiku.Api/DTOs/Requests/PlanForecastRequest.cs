namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>
/// What step 3 sends (contracts/plan-forecast-api.md): the checked setup and activities in the shapes of the
/// two Continue checks, so the server checks both again with the same rules (research section 8).
/// </summary>
public sealed record PlanForecastRequest(PlanSetupCheckRequest? Setup, List<PlanActivityRequest>? Activities);
