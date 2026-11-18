using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Data;

public class GeneratedScheduleConfiguration : IEntityTypeConfiguration<GeneratedSchedule>
{
    public void Configure(EntityTypeBuilder<GeneratedSchedule> builder)
    {
        builder.ToTable("GeneratedSchedules");
        builder.HasKey(schedule => schedule.Id);
        builder.Property(schedule => schedule.Id).ValueGeneratedNever();
        builder.Property(schedule => schedule.Snapshot)
            .HasConversion(PlanSnapshotConversion.Converter, PlanSnapshotConversion.Comparer)
            .HasColumnType("jsonb")
            .IsRequired();

        // Expired rows are deleted before each new insert (feature 010 research section 2).
        builder.HasIndex(schedule => schedule.ExpiresAtUtc)
            .HasDatabaseName("IX_GeneratedSchedules_ExpiresAtUtc");
    }
}
