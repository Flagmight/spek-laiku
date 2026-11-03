using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

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
