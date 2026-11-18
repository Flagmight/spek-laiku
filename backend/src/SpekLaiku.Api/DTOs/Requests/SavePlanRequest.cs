namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>
/// Saving a generated schedule (feature 010 contracts/plans-api.md). Only the remembered schedule's id and the
/// name are sent; the schedule itself never comes from the browser (spec FR-004). No owner field: the plan always
/// belongs to the signed-in user (spec FR-013).
/// </summary>
public sealed record SavePlanRequest(Guid? GeneratedScheduleId, string? Name);
