using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Data;

public class SavedPlanConfiguration : IEntityTypeConfiguration<SavedPlan>
{
    public void Configure(EntityTypeBuilder<SavedPlan> builder)
    {
        builder.ToTable("SavedPlans");
        builder.HasKey(plan => plan.Id);
        builder.Property(plan => plan.Id).ValueGeneratedNever();

        // Same column type as AspNetUsers.Id; deleting an account deletes its plans (feature 016).
        builder.Property(plan => plan.OwnerId).IsRequired();
        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(plan => plan.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(plan => plan.Name).HasColumnType("varchar(80)").IsRequired();
        builder.Property(plan => plan.LocationName).HasColumnType("varchar(200)").IsRequired();
        // Npgsql maps List<DateOnly> to a date[] column.
        builder.Property(plan => plan.Dates).IsRequired();
        builder.Property(plan => plan.Snapshot)
            .HasConversion(PlanSnapshotConversion.Converter, PlanSnapshotConversion.Comparer)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.HasIndex(plan => new { plan.OwnerId, plan.SavedAtUtc })
            .IsDescending(false, true)
            .HasDatabaseName("IX_SavedPlans_OwnerId_SavedAtUtc");
        builder.HasIndex(plan => plan.GeneratedScheduleId)
            .IsUnique()
            .HasDatabaseName("IX_SavedPlans_GeneratedScheduleId");
    }
}
