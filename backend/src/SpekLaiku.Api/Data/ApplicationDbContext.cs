using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<ApplicationUser>()
            .Property(user => user.AccountStatus)
            .HasConversion<int>()
            .HasDefaultValue(AccountStatus.PendingVerification);
        builder.Entity<ApplicationUser>()
            .Property(user => user.Role)
            .HasMaxLength(50);
    }
}
