using Npgsql;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// A throwaway database on an existing PostgreSQL server, for developer machines without Docker.
/// The server is chosen with the <see cref="VariableName"/> environment variable.
/// </summary>
public sealed class LocalPostgreSqlDatabase(string serverConnectionString)
{
    public const string VariableName = "SPEKLAIKU_TEST_POSTGRES";

    private readonly string databaseName = $"speklaiku_test_{Guid.NewGuid():N}";

    public string ConnectionString =>
        new NpgsqlConnectionStringBuilder(serverConnectionString) { Database = databaseName }.ConnectionString;

    public Task CreateAsync() => ExecuteOnServerAsync($"CREATE DATABASE \"{databaseName}\"");

    // FORCE closes connections the API's pool still holds open.
    public Task DropAsync() => ExecuteOnServerAsync($"DROP DATABASE IF EXISTS \"{databaseName}\" WITH (FORCE)");

    private async Task ExecuteOnServerAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(serverConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}
