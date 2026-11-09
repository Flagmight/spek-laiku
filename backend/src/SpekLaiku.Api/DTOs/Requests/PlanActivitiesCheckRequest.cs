namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>What the page sends on Continue (contracts/plan-activities-api.md).</summary>
public sealed record PlanActivitiesCheckRequest(List<PlanActivityRequest>? Activities);
