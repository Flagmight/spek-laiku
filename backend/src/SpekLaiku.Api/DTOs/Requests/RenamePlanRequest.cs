namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>Only the name; renaming never changes the schedule or the saved time (feature 011 spec FR-014).</summary>
public sealed record RenamePlanRequest(string? Name);
