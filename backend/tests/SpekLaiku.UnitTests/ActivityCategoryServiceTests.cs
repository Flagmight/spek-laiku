using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Listing and creating categories (spec FR-001 to FR-011, research sections 8 and 9).</summary>
public class ActivityCategoryServiceTests
{
    private const string DuplicateNameMessage = "A category with this name already exists.";

    private static readonly ActivityCategoryRequest Swimming = new(
        Name: "  Swimming  ",
        Type: "Outdoor",
        DefaultDurationHours: 2m,
        RequiresDaylight: true,
        MaxWindMs: 8m,
        MaxRainMmPerHour: 0.5m,
        MinTemperatureC: 18m,
        MaxTemperatureC: 35m,
        PlaceTags: " leisure=bathing_place , sport = swimming,,");

    [Fact]
    public async Task CreateAsync_StoresTheNormalizedValuesWithANewId()
    {
        await using var context = CreateContext();

        var result = await new ActivityCategoryService(context).CreateAsync(Swimming, CancellationToken.None);

        Assert.True(result.Succeeded);
        var stored = await context.ActivityCategories.AsNoTracking().SingleAsync();
        Assert.NotEqual(Guid.Empty, stored.Id);
        Assert.Equal(stored.Id, result.Category.Id);
        Assert.Equal("Swimming", stored.Name);
        Assert.Equal("SWIMMING", stored.NormalizedName);
        Assert.Equal(ActivityType.Outdoor, stored.Type);
        Assert.Equal(2m, stored.DefaultDurationHours);
        Assert.True(stored.RequiresDaylight);
        Assert.Equal(8m, stored.MaxWindMs);
        Assert.Equal(0.5m, stored.MaxRainMmPerHour);
        Assert.Equal(18m, stored.MinTemperatureC);
        Assert.Equal(35m, stored.MaxTemperatureC);
        Assert.Equal(["leisure=bathing_place", "sport=swimming"], stored.PlaceTags);
    }

    [Fact]
    public async Task CreateAsync_EachCategoryGetsItsOwnId()
    {
        await using var context = CreateContext();
        var service = new ActivityCategoryService(context);

        var first = await service.CreateAsync(Swimming, CancellationToken.None);
        var second = await service.CreateAsync(Swimming with { Name = "Rowing" }, CancellationToken.None);

        Assert.NotEqual(first.Category!.Id, second.Category!.Id);
    }

    [Fact]
    public async Task CreateAsync_IndoorRequestWithLimits_StoresNullLimits()
    {
        await using var context = CreateContext();
        var request = Swimming with { Name = "Indoor pool", Type = "Indoor" };

        var result = await new ActivityCategoryService(context).CreateAsync(request, CancellationToken.None);

        Assert.True(result.Succeeded);
        var stored = await context.ActivityCategories.AsNoTracking().SingleAsync();
        Assert.Equal(ActivityType.Indoor, stored.Type);
        Assert.Null(stored.MaxWindMs);
        Assert.Null(stored.MaxRainMmPerHour);
        Assert.Null(stored.MinTemperatureC);
        Assert.Null(stored.MaxTemperatureC);
    }

    [Fact]
    public async Task CreateAsync_InvalidRequest_ReturnsValidatorErrorsAndStoresNothing()
    {
        await using var context = CreateContext();
        var request = new ActivityCategoryRequest(null, null, null, false, null, null, null, null, null);

        var result = await new ActivityCategoryService(context).CreateAsync(request, CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal(ActivityCategoryValidator.Validate(request).Errors, result.Errors);
        Assert.Empty(await context.ActivityCategories.ToListAsync());
    }

    [Theory]
    [InlineData("kayaking")]
    [InlineData("KAYAKING")]
    [InlineData("  Kayaking  ")]
    public async Task CreateAsync_NameOfAnExistingCategory_ReturnsNameError(string name)
    {
        // The starter rows come from the migration, not HasData, so the in-memory database has none.
        await using var context = CreateContext();
        context.ActivityCategories.Add(Category("Kayaking"));
        await context.SaveChangesAsync();

        var result = await new ActivityCategoryService(context)
            .CreateAsync(Swimming with { Name = name }, CancellationToken.None);

        AssertNameError(result);
        Assert.Equal(1, await context.ActivityCategories.CountAsync(category => category.NormalizedName == "KAYAKING"));
    }

    [Fact]
    public async Task CreateAsync_UniqueViolationOnTheNameIndex_ReturnsNameError()
    {
        // A second save that passed the name check at the same moment is refused by the unique index.
        await using var context = CreateContext(new ThrowingSaveInterceptor(UniqueViolation(
            "IX_ActivityCategories_NormalizedName")));

        var result = await new ActivityCategoryService(context).CreateAsync(Swimming, CancellationToken.None);

        AssertNameError(result);
    }

    [Fact]
    public async Task CreateAsync_OtherDatabaseFailure_IsNotTranslated()
    {
        await using var context = CreateContext(new ThrowingSaveInterceptor(UniqueViolation("PK_ActivityCategories")));

        await Assert.ThrowsAsync<DbUpdateException>(
            () => new ActivityCategoryService(context).CreateAsync(Swimming, CancellationToken.None));
    }

    [Fact]
    public async Task ListAsync_ReturnsCategoriesOrderedByNormalizedNameByCodePoint()
    {
        await using var context = CreateContext();
        // "-" < "I" < "_" by code point, so the order is fixed whatever the database collation.
        context.ActivityCategories.AddRange(Category("Kayak_1"), Category("Kayaking"), Category("kayak-2"));
        await context.SaveChangesAsync();

        var categories = await new ActivityCategoryService(context).ListAsync(CancellationToken.None);

        Assert.Equal(["kayak-2", "Kayaking", "Kayak_1"], categories.Select(category => category.Name));
    }

    [Fact]
    public async Task ListAsync_WithNoCategories_ReturnsEmptyList()
    {
        await using var context = CreateContext();

        Assert.Empty(await new ActivityCategoryService(context).ListAsync(CancellationToken.None));
    }

    private static void AssertNameError(ActivityCategoryResult result)
    {
        Assert.False(result.Succeeded);
        var error = Assert.Single(result.Errors);
        Assert.Equal("name", error.Key);
        Assert.Equal(DuplicateNameMessage, error.Value);
    }

    private static ApplicationDbContext CreateContext(params IInterceptor[] interceptors)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(interceptors)
            .Options;
        return new ApplicationDbContext(options);
    }

    private static ActivityCategory Category(string name) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        NormalizedName = name.ToUpperInvariant(),
        Type = ActivityType.Indoor,
        DefaultDurationHours = 1m,
        PlaceTags = ["tourism=museum"]
    };

    private static DbUpdateException UniqueViolation(string constraintName) => new(
        "An error occurred while saving the entity changes.",
        new PostgresException(
            "duplicate key value violates unique constraint",
            "ERROR",
            "ERROR",
            PostgresErrorCodes.UniqueViolation,
            constraintName: constraintName));

    private sealed class ThrowingSaveInterceptor(Exception exception) : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default) => throw exception;
    }
}
