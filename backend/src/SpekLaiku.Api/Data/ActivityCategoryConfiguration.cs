using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Data;

public class ActivityCategoryConfiguration : IEntityTypeConfiguration<ActivityCategory>
{
    public void Configure(EntityTypeBuilder<ActivityCategory> builder)
    {
        builder.ToTable("ActivityCategories");
        builder.HasKey(category => category.Id);
        builder.Property(category => category.Id).ValueGeneratedNever();

        builder.Property(category => category.Name).HasColumnType("varchar(60)").IsRequired();
        builder.Property(category => category.NormalizedName).HasColumnType("varchar(60)").IsRequired();
        builder.HasIndex(category => category.NormalizedName)
            .IsUnique()
            .HasDatabaseName("IX_ActivityCategories_NormalizedName");

        builder.Property(category => category.Type).HasConversion<int>();

        builder.Property(category => category.DefaultDurationHours).HasPrecision(4, 1);
        builder.Property(category => category.MaxWindMs).HasPrecision(4, 1);
        builder.Property(category => category.MaxRainMmPerHour).HasPrecision(4, 1);
        builder.Property(category => category.MinTemperatureC).HasPrecision(4, 1);
        builder.Property(category => category.MaxTemperatureC).HasPrecision(4, 1);

        // Npgsql maps List<string> to a text[] column.
        builder.Property(category => category.PlaceTags).IsRequired();

        // Npgsql maps a uint row version to the xmin system column, so no real column is added
        // and the database checks it in the UPDATE's WHERE clause (research section 4).
        builder.Property(category => category.Version).IsRowVersion();

        // The starter categories are inserted by the AddActivityCategories migration, not with HasData:
        // EF Core compares text[] seed values by reference, so HasData reported a model change on every
        // build (research section 5 fallback).
    }
}
