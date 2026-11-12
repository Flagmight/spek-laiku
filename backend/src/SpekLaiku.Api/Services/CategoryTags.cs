namespace SpekLaiku.Api.Services;

/// <summary>A category of the plan and its map place tags, read from the database (spec FR-004).</summary>
public sealed record CategoryTags(Guid CategoryId, IReadOnlyList<string> Tags);
