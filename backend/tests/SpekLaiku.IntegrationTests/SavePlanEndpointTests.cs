using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plans</c> as an Active Registered User (feature 010 contracts/plans-api.md, spec FR-001 to FR-005,
/// FR-013). Each test generates its own schedule and uses its own user.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class SavePlanEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plans";
    private const string Expired = "Generate the schedule again to save it.";

    private readonly ScheduleScenario scenario = new(factory);

    [Fact]
    public async Task ValidSave_Returns201WithTheContractBodyAndStoresTheGeneratedSnapshot()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var scheduleId = await scenario.GenerateIdAsync(client);

        using var response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = scheduleId, name = "Weekend in Kaunas" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await ReadAsync(response);
        Assert.Equal(["id", "name", "locationName", "dates", "savedAt"], Keys(body));
        var id = body.GetProperty("id").GetGuid();
        Assert.Equal($"/api/plans/{id}", response.Headers.Location?.OriginalString);
        Assert.Equal("Weekend in Kaunas", body.GetProperty("name").GetString());
        Assert.Equal("Testinė", body.GetProperty("locationName").GetString());
        Assert.Equal([ScheduleScenario.PlanDate], body.GetProperty("dates").EnumerateArray().Select(date => date.GetString()));

        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = await context.SavedPlans.AsNoTracking().SingleAsync(saved => saved.Id == id);
        var generated = await context.GeneratedSchedules.AsNoTracking().SingleAsync(schedule => schedule.Id == scheduleId);
        Assert.Equal(scheduleId, plan.GeneratedScheduleId);
        Assert.Equal(ScheduleScenario.Now.UtcDateTime, plan.SavedAtUtc);
        Assert.Equal(Json(generated.Snapshot), Json(plan.Snapshot));
    }

    [Fact]
    public async Task SavingTheSameScheduleAgain_Returns200WithTheSamePlan()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var scheduleId = await scenario.GenerateIdAsync(client);
        var request = new { generatedScheduleId = scheduleId, name = "Weekend" };

        using var first = await client.PostAsJsonAsync(Path, request);
        using var second = await client.PostAsJsonAsync(Path, request);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal((await ReadAsync(first)).GetProperty("id").GetGuid(), (await ReadAsync(second)).GetProperty("id").GetGuid());
        Assert.Equal(1, await CountPlansAsync(scheduleId));
    }

    [Fact]
    public async Task TwoSavesAtTheSameTime_StoreOnePlan()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var scheduleId = await scenario.GenerateIdAsync(client);
        var request = new { generatedScheduleId = scheduleId, name = "Weekend" };

        var responses = await Task.WhenAll(
            client.PostAsJsonAsync(Path, request),
            client.PostAsJsonAsync(Path, request));

        Assert.All(responses, response => Assert.True(response.IsSuccessStatusCode));
        Assert.Equal(1, await CountPlansAsync(scheduleId));
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    public static TheoryData<string, string> InvalidNames => new()
    {
        { "", "Enter a plan name." },
        { "   ", "Enter a plan name." },
        { new string('a', 81), "Plan name can be at most 80 characters." }
    };

    [Theory]
    [MemberData(nameof(InvalidNames))]
    public async Task InvalidName_Returns400WithTheNameMessage(string name, string message)
    {
        using var client = await factory.CreateSignedInClientAsync();
        var scheduleId = await scenario.GenerateIdAsync(client);

        using var response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = scheduleId, name });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([message], Errors(await ReadAsync(response), "name"));
        Assert.Equal(0, await CountPlansAsync(scheduleId));
    }

    [Fact]
    public async Task NameWithSurroundingSpaces_IsSavedTrimmed()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var scheduleId = await scenario.GenerateIdAsync(client);

        using var response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = scheduleId, name = "  Trim me  " });

        Assert.Equal("Trim me", (await ReadAsync(response)).GetProperty("name").GetString());
    }

    [Fact]
    public async Task UnknownScheduleId_Returns400Expired()
    {
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = Guid.NewGuid(), name = "Weekend" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([Expired], Errors(await ReadAsync(response), "generatedScheduleId"));
    }

    [Fact]
    public async Task ScheduleOlderThan30Minutes_Returns400Expired()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var scheduleId = await scenario.GenerateIdAsync(client);

        HttpResponseMessage response;
        try
        {
            factory.Clock.UtcNow = ScheduleScenario.Now.AddMinutes(30);
            response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = scheduleId, name = "Weekend" });
        }
        finally
        {
            factory.Clock.UtcNow = ScheduleScenario.Now;
        }

        using (response)
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal([Expired], Errors(await ReadAsync(response), "generatedScheduleId"));
        }

        Assert.Equal(0, await CountPlansAsync(scheduleId));
    }

    [Fact]
    public async Task EmptyNameAndUnknownSchedule_ReturnBothErrors()
    {
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = Guid.NewGuid(), name = "" });

        var body = await ReadAsync(response);
        Assert.Equal(["Enter a plan name."], Errors(body, "name"));
        Assert.Equal([Expired], Errors(body, "generatedScheduleId"));
    }

    [Fact]
    public async Task MissingScheduleId_Returns400Expired()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var body = await scenario.GenerateAsync(client, await scenario.NothingScheduledPlanAsync());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("generatedScheduleId").ValueKind);

        using var response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = (Guid?)null, name = "Weekend" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([Expired], Errors(await ReadAsync(response), "generatedScheduleId"));
    }

    [Fact]
    public async Task OwnerInTheBody_IsIgnored()
    {
        var other = await factory.CreateUserAsync();
        using var client = await factory.CreateSignedInClientAsync();
        var scheduleId = await scenario.GenerateIdAsync(client);

        using var response = await client.PostAsJsonAsync(
            Path,
            new { generatedScheduleId = scheduleId, name = "Mine", ownerId = other.Id });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = await context.SavedPlans.AsNoTracking().SingleAsync(saved => saved.GeneratedScheduleId == scheduleId);
        Assert.NotEqual(other.Id, plan.OwnerId);
        Assert.False(await context.SavedPlans.AnyAsync(saved => saved.OwnerId == other.Id));
    }

    [Fact]
    public async Task VisitorsSchedule_CanBeSavedAfterSigningInOnTheSameClient()
    {
        // Feature 010 spec FR-007: the id from the Visitor's schedule still works after logging in.
        var account = await factory.CreateUserAsync();
        using var client = factory.CreateHttpsClient();
        var scheduleId = await scenario.GenerateIdAsync(client);
        using (var signIn = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(account.Email!)}", content: null))
        {
            Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
        }

        using var response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = scheduleId, name = "Weekend" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = await context.SavedPlans.AsNoTracking().SingleAsync(saved => saved.GeneratedScheduleId == scheduleId);
        Assert.Equal(account.Id, plan.OwnerId);
    }

    [Fact]
    public async Task Visitor_Gets401AndNothingIsSaved()
    {
        // Project FR-026: a Visitor cannot save a plan, even by calling the API directly.
        using var client = factory.CreateHttpsClient();
        var scheduleId = await scenario.GenerateIdAsync(client);

        using var response = await client.PostAsJsonAsync(Path, new { generatedScheduleId = scheduleId, name = "Weekend" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync());
        Assert.Equal(0, await CountPlansAsync(scheduleId));
    }

    private async Task<int> CountPlansAsync(Guid scheduleId)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await context.SavedPlans.CountAsync(plan => plan.GeneratedScheduleId == scheduleId);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    private static string Json(object value) => JsonSerializer.Serialize(value, PlanSnapshotConversion.JsonOptions);

    private static List<string> Keys(JsonElement element) =>
        element.EnumerateObject().Select(property => property.Name).ToList();

    private static List<string?> Errors(JsonElement body, string key) =>
        body.GetProperty("errors").GetProperty(key).EnumerateArray().Select(message => message.GetString()).ToList();
}
