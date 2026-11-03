using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Only a signed-in Active Administrator may use the category endpoints (contracts/categories-api.md
/// authorization table, spec FR-016 to FR-019, FR-023).
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AdminCategoriesAuthorizationTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/admin/categories";
    private static readonly string StarterPath = $"{Path}/{StarterCategories.KayakingId}";

    public static TheoryData<string> Endpoints => ["GET list", "GET one", "POST", "PUT"];

    public static TheoryData<string, string, string> RefusedCallers
    {
        get
        {
            var data = new TheoryData<string, string, string>();
            foreach (var endpoint in Endpoints)
            {
                data.Add(endpoint, "Registered User", nameof(AccountStatus.Active));
                data.Add(endpoint, "Registered User", nameof(AccountStatus.Suspended));
                data.Add(endpoint, "Administrator", nameof(AccountStatus.Suspended));
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task Visitor_Gets401WithEmptyBody(string endpoint)
    {
        using var client = factory.CreateHttpsClient();

        var response = await SendAsync(client, endpoint, PostgreSqlApiFactory.UniqueCategoryName("Visitor"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [MemberData(nameof(RefusedCallers))]
    public async Task OtherSignedInUser_Gets403WithoutCategoryData(string endpoint, string role, string status)
    {
        using var client = await factory.CreateSignedInClientAsync(role, Enum.Parse<AccountStatus>(status));

        var response = await SendAsync(client, endpoint, PostgreSqlApiFactory.UniqueCategoryName("Refused"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Kayaking", body);
        Assert.DoesNotContain("placeTags", body);
    }

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task ActiveAdministrator_IsNotRefused(string endpoint)
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");

        var response = await SendAsync(client, endpoint, PostgreSqlApiFactory.UniqueCategoryName("Allowed"));

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.True(response.StatusCode < HttpStatusCode.InternalServerError);
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    public async Task RefusedSave_StoresNothing(string endpoint)
    {
        using var refused = await factory.CreateSignedInClientAsync();
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        var name = PostgreSqlApiFactory.UniqueCategoryName("Refused save");
        var kayaking = await GetKayakingAsync(administrator);

        // The PUT sends the current version, so only authorization can stop it.
        var response = await SendAsync(refused, endpoint, name, kayaking.Version);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var categories = await administrator.GetFromJsonAsync<List<ActivityCategoryResponse>>(
            Path, JsonSerializerOptions.Web);
        Assert.DoesNotContain(categories!, category => category.Name == name);
        Assert.Equal(kayaking, await GetKayakingAsync(administrator), new ResponseComparer());
    }

    [Fact]
    public async Task AdministratorSuspendedAfterSignIn_Gets403OnTheNextRequest()
    {
        var user = await factory.CreateUserAsync(role: "Administrator");
        using var client = factory.CreateHttpsClient();
        var signIn = await client.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(user.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(Path)).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var stored = await userManager.FindByIdAsync(user.Id);
            stored!.AccountStatus = AccountStatus.Suspended;
            Assert.True((await userManager.UpdateAsync(stored)).Succeeded);
        }

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(Path)).StatusCode);
    }

    [Fact]
    public async Task Delete_Returns405AndTheCategoryStillExists()
    {
        using var client = await factory.CreateSignedInClientAsync("Administrator");

        var response = await client.DeleteAsync(StarterPath);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(StarterPath)).StatusCode);
    }

    // A valid body for POST and PUT. Version 0 is never a stored xmin, so an allowed PUT gets 409
    // and the starter category is not changed.
    private static Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        string endpoint,
        string name,
        uint version = 0)
    {
        var body = new
        {
            name,
            type = "Indoor",
            defaultDurationHours = 2,
            requiresDaylight = false,
            placeTags = "tourism=museum",
            version
        };
        return endpoint switch
        {
            "GET list" => client.GetAsync(Path),
            "GET one" => client.GetAsync(StarterPath),
            "POST" => client.PostAsJsonAsync(Path, body),
            "PUT" => client.PutAsJsonAsync(StarterPath, body),
            _ => throw new ArgumentOutOfRangeException(nameof(endpoint))
        };
    }

    private static async Task<ActivityCategoryResponse> GetKayakingAsync(HttpClient administrator) =>
        (await administrator.GetFromJsonAsync<ActivityCategoryResponse>(StarterPath, JsonSerializerOptions.Web))!;

    // Records compare the tag list by reference, so compare it by value here.
    private sealed class ResponseComparer : IEqualityComparer<ActivityCategoryResponse>
    {
        public bool Equals(ActivityCategoryResponse? x, ActivityCategoryResponse? y) =>
            x is not null && y is not null
            && x with { PlaceTags = [] } == y with { PlaceTags = [] }
            && x.PlaceTags.SequenceEqual(y.PlaceTags);

        public int GetHashCode(ActivityCategoryResponse obj) => obj.Id.GetHashCode();
    }
}
