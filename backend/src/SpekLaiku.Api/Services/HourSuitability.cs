namespace SpekLaiku.Api.Services;

/// <summary>Whether one planning hour suits one activity: suitable when there is no reason against it.</summary>
public sealed record HourSuitability(TimeOnly Start, IReadOnlyList<string> Reasons)
{
    public bool Suitable => Reasons.Count == 0;
}
