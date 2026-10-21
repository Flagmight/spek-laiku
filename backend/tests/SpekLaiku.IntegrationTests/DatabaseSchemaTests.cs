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
