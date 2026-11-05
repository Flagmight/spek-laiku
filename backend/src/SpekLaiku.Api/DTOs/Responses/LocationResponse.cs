namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>The location object in contracts/plan-setup-api.md, shown as "&lt;name&gt;, &lt;area&gt;".</summary>
public sealed record LocationResponse(long Id, string Name, string Area, double Latitude, double Longitude);
