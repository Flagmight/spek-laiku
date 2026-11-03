using Microsoft.EntityFrameworkCore;
using Npgsql;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Lists and creates activity categories (spec FR-001 to FR-011). A technical failure is not caught
/// or logged here: it reaches ApiExceptionHandler, which logs it and answers 500 (research section 11).
/// </summary>
public sealed class ActivityCategoryService(ApplicationDbContext context)
{
    public const string DuplicateNameMessage = "A category with this name already exists.";
    private const string NameIndex = "IX_ActivityCategories_NormalizedName";

    /// <summary>
    /// Every category ordered by normalized name, compared by code point in memory so the order is
    /// the same on every PostgreSQL server whatever its collation (research section 9).
    /// </summary>
    public async Task<IReadOnlyList<ActivityCategory>> ListAsync(CancellationToken cancellationToken)
    {
        var categories = await context.ActivityCategories.AsNoTracking().ToListAsync(cancellationToken);
        return [.. categories.OrderBy(category => category.NormalizedName, StringComparer.Ordinal)];
    }

    public async Task<ActivityCategoryResult> CreateAsync(
        ActivityCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var validation = ActivityCategoryValidator.Validate(request);
        if (!validation.IsValid)
        {
            return ActivityCategoryResult.Invalid(validation.Errors);
        }

        var values = validation.Category;
        if (await context.ActivityCategories.AnyAsync(
                category => category.NormalizedName == values.NormalizedName, cancellationToken))
        {
            return DuplicateName();
        }

        var category = new ActivityCategory { Id = Guid.NewGuid() };
        Apply(values, category);
        context.ActivityCategories.Add(category);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsDuplicateName(exception))
        {
            // Another save with the same name passed the check above at the same moment (research section 8).
            return DuplicateName();
        }

        return ActivityCategoryResult.Success(category);
    }

    private static void Apply(ValidActivityCategory values, ActivityCategory category)
    {
        category.Name = values.Name;
        category.NormalizedName = values.NormalizedName;
        category.Type = values.Type;
        category.DefaultDurationHours = values.DefaultDurationHours;
        category.RequiresDaylight = values.RequiresDaylight;
        category.MaxWindMs = values.MaxWindMs;
        category.MaxRainMmPerHour = values.MaxRainMmPerHour;
        category.MinTemperatureC = values.MinTemperatureC;
        category.MaxTemperatureC = values.MaxTemperatureC;
        category.PlaceTags = [.. values.PlaceTags];
    }

    private static ActivityCategoryResult DuplicateName() =>
        ActivityCategoryResult.Invalid(new Dictionary<string, string> { ["name"] = DuplicateNameMessage });

    private static bool IsDuplicateName(DbUpdateException exception) =>
        exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: NameIndex
        };
}
