using Microsoft.EntityFrameworkCore;
using Npgsql;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Lists, reads, creates and edits activity categories (spec FR-001 to FR-011, FR-026). A technical failure is not caught
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
        return await SaveAsync(category, cancellationToken);
    }

    public Task<ActivityCategory?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        context.ActivityCategories.AsNoTracking()
            .SingleOrDefaultAsync(category => category.Id == id, cancellationToken);

    /// <summary>
    /// Checks in the contract's order: the fields, that the category exists, that the version is the
    /// one the form was opened with, then that no other category has the name (spec FR-026).
    /// </summary>
    public async Task<ActivityCategoryResult> UpdateAsync(
        Guid id,
        UpdateActivityCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var validation = ActivityCategoryValidator.Validate(request.ToCategoryRequest());
        if (!validation.IsValid)
        {
            return ActivityCategoryResult.Invalid(validation.Errors);
        }

        var category = await context.ActivityCategories
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (category is null)
        {
            return ActivityCategoryResult.NotFound();
        }

        if (category.Version != request.Version)
        {
            return ActivityCategoryResult.Conflict();
        }

        // The UPDATE's WHERE clause compares xmin with this value, so a change committed after the
        // read above is refused by the database itself (research section 4).
        context.Entry(category).Property(entity => entity.Version).OriginalValue = request.Version;

        var values = validation.Category;
        if (await context.ActivityCategories.AnyAsync(
                other => other.Id != id && other.NormalizedName == values.NormalizedName, cancellationToken))
        {
            return DuplicateName();
        }

        Apply(values, category);
        try
        {
            return await SaveAsync(category, cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return ActivityCategoryResult.Conflict();
        }
    }

    private async Task<ActivityCategoryResult> SaveAsync(ActivityCategory category, CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsDuplicateName(exception))
        {
            // Another save with the same name passed the name check at the same moment (research section 8).
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
