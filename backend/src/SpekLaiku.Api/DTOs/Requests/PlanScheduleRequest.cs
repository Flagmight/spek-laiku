namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>
/// What the Schedule Overview generates from (contracts/plan-schedule-api.md): the checked setup and
/// activities, same shapes as the forecast and places requests (spec FR-002, FR-011).
/// </summary>
public sealed record PlanScheduleRequest(PlanSetupCheckRequest? Setup, List<PlanActivityRequest>? Activities);
