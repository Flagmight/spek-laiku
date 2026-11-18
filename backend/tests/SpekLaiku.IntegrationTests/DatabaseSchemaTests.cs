using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

[Collection(PostgreSqlCollection.Name)]
public class DatabaseSchemaTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task Schema_RejectsSecondUserWithSameNormalizedEmail()
    {
        var normalizedEmail = $"DUPLICATE-{Guid.NewGuid():N}@EXAMPLE.COM";
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        context.Users.Add(CreateUser(normalizedEmail.ToLowerInvariant(), normalizedEmail));
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        context.Users.Add(CreateUser(normalizedEmail, normalizedEmail));
        var exception = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());

        var postgresException = Assert.IsType<PostgresException>(exception.InnerException);
        Assert.Equal(PostgresErrorCodes.UniqueViolation, postgresException.SqlState);
        Assert.Equal("EmailIndex", postgresException.ConstraintName);
    }

    // Values from the starter table in specs/003-activity-categories/data-model.md, written out here
    // rather than read from StarterCategories, so the test checks the migration independently.
    private static readonly Dictionary<string, ActivityCategory> ExpectedStarterCategories = new()
    {
        ["CYCLING"] = new()
        {
            Name = "Cycling",
            Type = ActivityType.Outdoor,
            DefaultDurationHours = 2.0m,
            RequiresDaylight = true,
            MaxWindMs = 10.0m,
            MaxRainMmPerHour = 1.0m,
            MinTemperatureC = 5.0m,
            MaxTemperatureC = 32.0m,
            PlaceTags = ["highway=cycleway", "route=bicycle"]
        },
        ["KAYAKING"] = new()
        {
            Name = "Kayaking",
            Type = ActivityType.Outdoor,
            DefaultDurationHours = 2.0m,
            RequiresDaylight = true,
            MaxWindMs = 8.0m,
            MaxRainMmPerHour = 0.5m,
            MinTemperatureC = 15.0m,
            MaxTemperatureC = 35.0m,
            PlaceTags = ["leisure=slipway", "sport=canoe"]
        },
        ["PICNIC"] = new()
        {
            Name = "Picnic",
            Type = ActivityType.Outdoor,
            DefaultDurationHours = 1.5m,
            RequiresDaylight = true,
            MaxWindMs = 8.0m,
            MaxRainMmPerHour = 0.0m,
            MinTemperatureC = 15.0m,
            MaxTemperatureC = 32.0m,
            PlaceTags = ["tourism=picnic_site", "leisure=picnic_table"]
        },
        ["HERITAGE SITE"] = new()
        {
            Name = "Heritage site",
            Type = ActivityType.Outdoor,
            DefaultDurationHours = 1.5m,
            RequiresDaylight = true,
            MaxWindMs = 15.0m,
            MaxRainMmPerHour = 2.0m,
            MinTemperatureC = 0.0m,
            MaxTemperatureC = 35.0m,
            PlaceTags = ["historic=castle", "historic=manor", "historic=monument", "historic=archaeological_site"]
        },
        ["MUSEUM"] = new()
        {
            Name = "Museum",
            Type = ActivityType.Indoor,
            DefaultDurationHours = 2.0m,
            RequiresDaylight = false,
            MaxWindMs = null,
            MaxRainMmPerHour = null,
            MinTemperatureC = null,
            MaxTemperatureC = null,
            PlaceTags = ["tourism=museum"]
        }
    };

    [Theory]
    [InlineData("CYCLING")]
    [InlineData("KAYAKING")]
    [InlineData("PICNIC")]
    [InlineData("HERITAGE SITE")]
    [InlineData("MUSEUM")]
    public async Task Migrations_InsertStarterCategory(string normalizedName)
    {
        var expected = ExpectedStarterCategories[normalizedName];
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var category = await context.ActivityCategories.AsNoTracking()
            .SingleAsync(candidate => candidate.NormalizedName == normalizedName);

        Assert.Equal(expected.Name, category.Name);
        Assert.Equal(expected.Type, category.Type);
        Assert.Equal(expected.DefaultDurationHours, category.DefaultDurationHours);
        Assert.Equal(expected.RequiresDaylight, category.RequiresDaylight);
        Assert.Equal(expected.MaxWindMs, category.MaxWindMs);
        Assert.Equal(expected.MaxRainMmPerHour, category.MaxRainMmPerHour);
        Assert.Equal(expected.MinTemperatureC, category.MinTemperatureC);
        Assert.Equal(expected.MaxTemperatureC, category.MaxTemperatureC);
        Assert.Equal(expected.PlaceTags, category.PlaceTags);
        // xmin is read back as the row version.
        Assert.NotEqual(0u, category.Version);
    }

    [Fact]
    public async Task Migrations_InsertTheFiveStarterCategoriesWithFixedIds()
    {
        Guid[] starterIds =
        [
            StarterCategories.CyclingId,
            StarterCategories.KayakingId,
            StarterCategories.PicnicId,
            StarterCategories.HeritageSiteId,
            StarterCategories.MuseumId
        ];
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var seededIds = await context.ActivityCategories.AsNoTracking()
            .Where(category => starterIds.Contains(category.Id))
            .Select(category => category.Id)
            .ToListAsync();

        Assert.Equal(starterIds.Order(), seededIds.Order());
    }

    [Fact]
    public async Task Schema_RejectsSecondCategoryWithSameNormalizedName()
    {
        var normalizedName = $"DUPLICATE-{Guid.NewGuid():N}";
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        context.ActivityCategories.Add(CreateCategory(normalizedName.ToLowerInvariant(), normalizedName));
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        context.ActivityCategories.Add(CreateCategory(normalizedName, normalizedName));
        var exception = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());

        var postgresException = Assert.IsType<PostgresException>(exception.InnerException);
        Assert.Equal(PostgresErrorCodes.UniqueViolation, postgresException.SqlState);
        Assert.Equal("IX_ActivityCategories_NormalizedName", postgresException.ConstraintName);
    }

    [Theory]
    [InlineData("SavedPlans", "Snapshot", "jsonb")]
    [InlineData("SavedPlans", "Dates", "_date")]
    [InlineData("SavedPlans", "Name", "varchar")]
    [InlineData("SavedPlans", "OwnerId", "text")]
    [InlineData("GeneratedSchedules", "Snapshot", "jsonb")]
    [InlineData("GeneratedSchedules", "ExpiresAtUtc", "timestamptz")]
    public async Task Migrations_CreateSavedPlanColumns(string table, string column, string type)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var columnType = await context.Database
            .SqlQuery<string>(
                $"SELECT udt_name AS \"Value\" FROM information_schema.columns WHERE table_name = {table} AND column_name = {column}")
            .SingleAsync();

        Assert.Equal(type, columnType);
    }

    [Fact]
    public async Task Migrations_LimitSavedPlanNamesTo80Characters()
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var length = await context.Database
            .SqlQuery<int>(
                $"SELECT character_maximum_length AS \"Value\" FROM information_schema.columns WHERE table_name = 'SavedPlans' AND column_name = 'Name'")
            .SingleAsync();

        Assert.Equal(80, length);
    }

    [Fact]
    public async Task Migrations_MakeTheGeneratedScheduleIdUnique()
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var definition = await context.Database
            .SqlQuery<string>(
                $"SELECT indexdef AS \"Value\" FROM pg_indexes WHERE indexname = 'IX_SavedPlans_GeneratedScheduleId'")
            .SingleAsync();

        Assert.StartsWith("CREATE UNIQUE INDEX", definition);
    }

    [Fact]
    public async Task Schema_DeletesSavedPlansWithTheirOwner()
    {
        var owner = await factory.CreateUserAsync();
        var planId = Guid.NewGuid();
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        context.SavedPlans.Add(new SavedPlan
        {
            Id = planId,
            OwnerId = owner.Id,
            Name = "Weekend in Kaunas",
            SavedAtUtc = DateTime.UtcNow,
            LocationName = "Kaunas",
            Dates = [new DateOnly(2026, 11, 21)],
            Snapshot = new PlanSnapshot(
                new CheckedPlanSetup(new PlaceLocation(1, "Kaunas", "Kaunas", 54.9, 23.9), [new DateOnly(2026, 11, 21)], 30),
                [],
                new PlanSchedule([], [], new TravelSummary(30, 0)))
        });
        await context.SaveChangesAsync();

        await context.Users.Where(user => user.Id == owner.Id).ExecuteDeleteAsync();

        Assert.False(await context.SavedPlans.AnyAsync(plan => plan.Id == planId));
    }

    private static ActivityCategory CreateCategory(string name, string normalizedName) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        NormalizedName = normalizedName,
        Type = ActivityType.Indoor,
        DefaultDurationHours = 1.0m,
        PlaceTags = ["tourism=museum"]
    };

    private static ApplicationUser CreateUser(string email, string normalizedEmail) => new()
    {
        Email = email,
        NormalizedEmail = normalizedEmail,
        // Distinct user names, so only the email index can reject the second insert.
        UserName = Guid.NewGuid().ToString(),
        NormalizedUserName = Guid.NewGuid().ToString().ToUpperInvariant(),
        RegistrationDate = DateTime.UtcNow
    };
}
