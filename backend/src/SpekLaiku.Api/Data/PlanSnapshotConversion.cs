using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Data;

/// <summary>
/// How a <see cref="PlanSnapshot"/> is written to its <c>jsonb</c> column (feature 010 research section 4):
/// camelCase JSON with enums by name, so a stored plan stays readable when an enum gains a value. The snapshot
/// is immutable, so the comparer compares the written JSON and keeps the same instance as its snapshot.
/// </summary>
public static class PlanSnapshotConversion
{
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public static readonly ValueConverter<PlanSnapshot, string> Converter = new(
        snapshot => JsonSerializer.Serialize(snapshot, JsonOptions),
        json => JsonSerializer.Deserialize<PlanSnapshot>(json, JsonOptions)!);

    public static readonly ValueComparer<PlanSnapshot> Comparer = new(
        (left, right) => ToJson(left) == ToJson(right),
        snapshot => ToJson(snapshot).GetHashCode(),
        snapshot => snapshot);

    private static string ToJson(PlanSnapshot? snapshot) => JsonSerializer.Serialize(snapshot, JsonOptions);
}
