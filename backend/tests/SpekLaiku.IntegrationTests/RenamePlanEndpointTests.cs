using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>PUT /api/plans/{id}/name</c> (feature 011 contracts/plans-api.md, spec FR-014, FR-017, FR-018): only the
/// owner's plan name changes, with the feature 010 name rules. Authorization is in
/// <c>PlanManagementAuthorizationTests</c>.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class RenamePlanEndpointTests(PostgreSqlApiFactory factory)
{
    private readonly ScheduleScenario scenario = new(factory);

    [Fact]
    public async Task Renaming_ChangesOnlyTheName()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend in Kaunas");
        var before = await StoredAsync(id);

        using var response = await RenameAsync(client, id, "Kaunas trip");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await ReadAsync(response);
        Assert.Equal(id, summary.GetProperty("id").GetGuid());
        Assert.Equal("Kaunas trip", summary.GetProperty("name").GetString());
        Assert.Equal(before with { Name = "Kaunas trip" }, await StoredAsync(id));
    }

    [Fact]
    public async Task ANameWithSpaces_IsTrimmed()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");

        using var response = await RenameAsync(client, id, "  Kaunas trip  ");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Kaunas trip", (await StoredAsync(id)).Name);
    }

    [Theory]
    [InlineData("", "Enter a plan name.")]
    [InlineData("   ", "Enter a plan name.")]
    [InlineData(null, "Enter a plan name.")]
    [InlineData("81", "Plan name can be at most 80 characters.")]
    public async Task AnInvalidName_IsRefusedAndTheNameIsUnchanged(string? name, string message)
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        var sent = name == "81" ? new string('a', 81) : name;

        using var response = await RenameAsync(client, id, sent);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadAsync(response)).GetProperty("errors");
        Assert.Equal(message, errors.GetProperty("name")[0].GetString());
        Assert.Equal("Weekend", (await StoredAsync(id)).Name);
    }

    [Fact]
    public async Task MarkupInAName_IsStoredAsText()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");

        using var response = await RenameAsync(client, id, "<script>");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("<script>", (await StoredAsync(id)).Name);
    }

    [Fact]
    public async Task AnUnknownPlanWithAnEmptyName_IsNotFound()
    {
        using var client = await factory.CreateSignedInClientAsync();

        using var response = await RenameAsync(client, Guid.NewGuid(), "");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("This plan no longer exists.", (await ReadAsync(response)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Renaming_CallsNeitherExternalService()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var id = await SaveAsync(client, "Weekend");
        var forecastCalls = factory.Forecast.Calls;
        var mapCalls = factory.MapPlaces.Calls;

        using var response = await RenameAsync(client, id, "Kaunas trip");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(forecastCalls, factory.Forecast.Calls);
        Assert.Equal(mapCalls, factory.MapPlaces.Calls);
    }

    private static Task<HttpResponseMessage> RenameAsync(HttpClient client, Guid id, string? name) =>
        client.PutAsJsonAsync($"/api/plans/{id}/name", new { name });

    private async Task<Guid> SaveAsync(HttpClient client, string name)
    {
        var scheduleId = await scenario.GenerateIdAsync(client);
        using var response = await client.PostAsJsonAsync("/api/plans", new { generatedScheduleId = scheduleId, name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadAsync(response)).GetProperty("id").GetGuid();
    }

    private sealed record Stored(
        string Name,
        DateTime SavedAtUtc,
        DateTime CreatedAtUtc,
        Guid? GeneratedScheduleId,
        string Snapshot);

    private async Task<Stored> StoredAsync(Guid id)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = await context.SavedPlans.AsNoTracking().SingleAsync(saved => saved.Id == id);
        return new Stored(
            plan.Name,
            plan.SavedAtUtc,
            plan.CreatedAtUtc,
            plan.GeneratedScheduleId,
            JsonSerializer.Serialize(plan.Snapshot));
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }
}
