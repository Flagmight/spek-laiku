using System.Net;
using System.Text.Json;
using SpekLaiku.Api.Entities;
using static SpekLaiku.IntegrationTests.AdminAccountRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>GET /api/admin/accounts</c> (feature 014 contracts/admin-accounts-api.md, spec FR-001, FR-002, FR-011). The
/// database also holds other tests' accounts, so each test searches for a marker in its own accounts' emails (research
/// section 14). Authorization is in <c>AdminAccountsAuthorizationTests</c>.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AdminAccountsListEndpointTests(PostgreSqlApiFactory factory)
{
    private static readonly DateTime Base = new(2026, 11, 1, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Search_MatchesAnyPartOfTheEmailIgnoringCase()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var marker = Marker("case");
        await factory.CreateUserAsync(email: Email(marker, "ana"), registrationDate: Base);
        await factory.CreateUserAsync(email: Email(marker, "bob"), registrationDate: Base.AddDays(1));

        var (status, body) = await ListAsync(admin, marker.ToUpperInvariant());

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal([Email(marker, "bob"), Email(marker, "ana")], Emails(body));
    }

    [Fact]
    public async Task Search_TrimsSpaces()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var marker = Marker("trim");
        await factory.CreateUserAsync(email: Email(marker, "ana"));

        var (status, body) = await ListAsync(admin, $"   {marker}  ");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal([Email(marker, "ana")], Emails(body));
    }

    // A LIKE pattern would let "_" stand for any one character and "%" for any text, so both accounts would match.
    [Theory]
    [InlineData("_")]
    [InlineData("%")]
    public async Task Search_MatchesUnderscoreAndPercentLiterally(string wildcard)
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var marker = Marker("literal");
        var literal = $"x{wildcard}{marker}@example.com";
        await factory.CreateUserAsync(email: literal);
        await factory.CreateUserAsync(email: $"xy{marker}@example.com");

        var (status, body) = await ListAsync(admin, $"{wildcard}{marker}");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal([literal], Emails(body));
    }

    [Fact]
    public async Task List_IsNewestRegistrationFirst()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var marker = Marker("order");
        await factory.CreateUserAsync(email: Email(marker, "middle"), registrationDate: Base.AddDays(1));
        await factory.CreateUserAsync(email: Email(marker, "oldest"), registrationDate: Base);
        await factory.CreateUserAsync(email: Email(marker, "newest"), registrationDate: Base.AddDays(2));

        var (_, body) = await ListAsync(admin, marker);

        Assert.Equal([Email(marker, "newest"), Email(marker, "middle"), Email(marker, "oldest")], Emails(body));
    }

    [Fact]
    public async Task FiftyOneMatches_Return50WithHasMore()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var marker = Marker("limit");
        await CreateNumberedAsync(marker, 51);

        var (status, body) = await ListAsync(admin, marker);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.True(body.GetProperty("hasMore").GetBoolean());
        // The 50 newest: number 50 down to 1, without number 0, the oldest.
        Assert.Equal(Enumerable.Range(1, 50).Reverse().Select(number => Email(marker, $"n{number:00}")), Emails(body));
    }

    [Fact]
    public async Task ExactlyFiftyMatches_ReturnHasMoreFalse()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var marker = Marker("fifty");
        await CreateNumberedAsync(marker, 50);

        var (_, body) = await ListAsync(admin, marker);

        Assert.False(body.GetProperty("hasMore").GetBoolean());
        Assert.Equal(50, Emails(body).Count);
    }

    [Fact]
    public async Task NoMatch_ReturnsEmptyList()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");

        var (status, body) = await ListAsync(admin, Marker("nobody"));

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Empty(Emails(body));
        Assert.False(body.GetProperty("hasMore").GetBoolean());
    }

    [Fact]
    public async Task TooLongSearch_Gets400()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");

        var (status, body) = await ListAsync(admin, new string('a', 257));

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = body.GetProperty("errors").GetProperty("search");
        Assert.Equal("Search text can be at most 256 characters.", Assert.Single(errors.EnumerateArray()).GetString());
    }

    [Fact]
    public async Task List_ReturnsOnlyTheFiveFields()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var marker = Marker("fields");
        var user = await factory.CreateUserAsync(email: Email(marker, "ana"));
        var stored = await StoredAsync(factory, user.Id);

        using var response = await admin.GetAsync($"{ListPath}?search={marker}");
        var raw = await response.Content.ReadAsStringAsync();

        var account = Assert.Single(JsonDocument.Parse(raw).RootElement.GetProperty("accounts").EnumerateArray());
        Assert.Equal(
            ["id", "email", "role", "accountStatus", "registrationDate"],
            account.EnumerateObject().Select(property => property.Name));
        Assert.False(string.IsNullOrEmpty(stored.PasswordHash));
        Assert.DoesNotContain(stored.PasswordHash!, raw);
        Assert.DoesNotContain(stored.SecurityStamp!, raw);
        Assert.DoesNotContain(stored.ConcurrencyStamp!, raw);
    }

    [Fact]
    public async Task AdministratorAccounts_AreListedWithTheirRole()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var marker = Marker("admins");
        await factory.CreateUserAsync(role: "Administrator", email: Email(marker, "active"), registrationDate: Base.AddDays(1));
        await factory.CreateUserAsync(
            AccountStatus.Suspended, role: "Administrator", email: Email(marker, "suspended"), registrationDate: Base);

        var (_, body) = await ListAsync(admin, marker);

        var accounts = body.GetProperty("accounts").EnumerateArray().ToList();
        Assert.Equal(2, accounts.Count);
        Assert.All(accounts, account => Assert.Equal("Administrator", account.GetProperty("role").GetString()));
        Assert.Equal(["Active", "Suspended"], accounts.Select(account => account.GetProperty("accountStatus").GetString()));
    }

    // Accounts number 0 (the oldest) to count - 1 (the newest), one minute apart.
    private async Task CreateNumberedAsync(string marker, int count)
    {
        for (var number = 0; number < count; number++)
        {
            await factory.CreateUserAsync(email: Email(marker, $"n{number:00}"), registrationDate: Base.AddMinutes(number));
        }
    }

    private static List<string?> Emails(JsonElement body) =>
        [.. body.GetProperty("accounts").EnumerateArray().Select(account => account.GetProperty("email").GetString())];
}
