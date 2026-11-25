using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Entities;
using static SpekLaiku.IntegrationTests.AdminAccountRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>PUT /api/admin/accounts/{id}/status</c> (feature 014 contracts/admin-accounts-api.md, spec FR-007, FR-008,
/// FR-010): an Active Administrator suspends and reactivates Registered User accounts, and nothing else about the
/// account changes. Authorization is in <c>AdminAccountsAuthorizationTests</c>.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AdminAccountStatusEndpointTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task Suspend_Answers200WithTheSuspendedAccount()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync();

        using var response = await SetStatusAsync(admin, target.Id, "Suspended");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadAsync(response);
        Assert.Equal(target.Id, body.GetProperty("id").GetString());
        Assert.Equal(target.Email, body.GetProperty("email").GetString());
        Assert.Equal("Registered User", body.GetProperty("role").GetString());
        Assert.Equal("Suspended", body.GetProperty("accountStatus").GetString());
        Assert.Equal(AccountStatus.Suspended, (await StoredAsync(factory, target.Id)).AccountStatus);
    }

    [Fact]
    public async Task Suspend_ChangesTheConcurrencyStamp()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync();
        var before = await StoredAsync(factory, target.Id);

        using var response = await SetStatusAsync(admin, target.Id, "Suspended");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotEqual(before.ConcurrencyStamp, (await StoredAsync(factory, target.Id)).ConcurrencyStamp);
    }

    [Fact]
    public async Task Suspend_KeepsEmailRoleRegistrationDateAndPasswordHash()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync();
        var before = await StoredAsync(factory, target.Id);

        using var response = await SetStatusAsync(admin, target.Id, "Suspended");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var after = await StoredAsync(factory, target.Id);
        Assert.Equal(
            before with { AccountStatus = AccountStatus.Suspended, ConcurrencyStamp = after.ConcurrencyStamp },
            after);
    }

    [Fact]
    public async Task SuspendTwice_SecondAnswers200WithNoChange()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync();
        using (await SetStatusAsync(admin, target.Id, "Suspended"))
        {
        }

        var afterFirst = await StoredAsync(factory, target.Id);

        using var response = await SetStatusAsync(admin, target.Id, "Suspended");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Suspended", (await ReadAsync(response)).GetProperty("accountStatus").GetString());
        Assert.Equal(afterFirst, await StoredAsync(factory, target.Id));
    }

    [Fact]
    public async Task Reactivate_Answers200WithTheActiveAccount()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync(AccountStatus.Suspended);

        using var response = await SetStatusAsync(admin, target.Id, "Active");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Active", (await ReadAsync(response)).GetProperty("accountStatus").GetString());
        Assert.Equal(AccountStatus.Active, (await StoredAsync(factory, target.Id)).AccountStatus);
    }

    [Fact]
    public async Task ReactivateAnActiveAccount_Answers200WithNoChange()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync();
        var before = await StoredAsync(factory, target.Id);

        using var response = await SetStatusAsync(admin, target.Id, "Active");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Active", (await ReadAsync(response)).GetProperty("accountStatus").GetString());
        Assert.Equal(before, await StoredAsync(factory, target.Id));
    }

    [Fact]
    public async Task UnknownId_Gets404WithTheMessage()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");

        using var response = await SetStatusAsync(admin, Guid.NewGuid().ToString(), "Suspended");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await ReadAsync(response);
        Assert.Equal("Not found.", body.GetProperty("title").GetString());
        Assert.Equal("This account no longer exists.", body.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task IdLongerThanIdentityKeys_Gets404()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");

        using var response = await SetStatusAsync(admin, new string('a', 451), "Suspended");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("suspended")]
    [InlineData("1")]
    [InlineData("Deleted")]
    public async Task MissingOrInvalidStatus_Gets400AndTheAccountIsUnchanged(string? status)
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync();
        var before = await StoredAsync(factory, target.Id);

        using var response = await SetStatusAsync(admin, target.Id, status);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadAsync(response)).GetProperty("errors").GetProperty("accountStatus");
        Assert.Equal("Select Active or Suspended.", Assert.Single(errors.EnumerateArray()).GetString());
        Assert.Equal(before, await StoredAsync(factory, target.Id));
    }

    [Theory]
    [InlineData(nameof(AccountStatus.Active), "Suspended")]
    [InlineData(nameof(AccountStatus.Suspended), "Active")]
    public async Task AdministratorTarget_Gets409Unchanged(string targetStatus, string requested)
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync(Enum.Parse<AccountStatus>(targetStatus), role: "Administrator");
        var before = await StoredAsync(factory, target.Id);

        using var response = await SetStatusAsync(admin, target.Id, requested);

        AssertAdministratorAccountRefused(response, await ReadAsync(response));
        Assert.Equal(before, await StoredAsync(factory, target.Id));
    }

    [Fact]
    public async Task OwnAccount_Gets409Unchanged()
    {
        var (self, admin) = await factory.CreateSignedInUserAsync("Administrator");
        using (admin)
        {
            var before = await StoredAsync(factory, self.Id);

            using var response = await SetStatusAsync(admin, self.Id, "Suspended");

            AssertAdministratorAccountRefused(response, await ReadAsync(response));
            Assert.Equal(before, await StoredAsync(factory, self.Id));
            using var list = await admin.GetAsync(ListPath);
            Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        }
    }

    private static void AssertAdministratorAccountRefused(HttpResponseMessage response, JsonElement body)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("Administrator account.", body.GetProperty("title").GetString());
        Assert.Equal(
            "Administrator accounts cannot be suspended or reactivated here.", body.GetProperty("detail").GetString());
    }

    [Theory]
    [InlineData("")]
    [InlineData("null")]
    public async Task EmptyOrNullBody_Gets400WithTheStatusMessage(string body)
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync();
        var before = await StoredAsync(factory, target.Id);
        using var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        using var response = await admin.PutAsync(StatusPath(target.Id), content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadAsync(response)).GetProperty("errors").GetProperty("accountStatus");
        Assert.Equal("Select Active or Suspended.", Assert.Single(errors.EnumerateArray()).GetString());
        Assert.Equal(before, await StoredAsync(factory, target.Id));
    }

    // Identity's UpdateAsync writes every column. An update built from the account as it was before the suspension
    // (as counting a failed login does) must fail, not write "Active" back (research section 3).
    [Fact]
    public async Task StaleIdentityUpdate_DoesNotUndoTheSuspension()
    {
        using var admin = await factory.CreateSignedInClientAsync("Administrator");
        var target = await factory.CreateUserAsync();
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var stale = await userManager.FindByIdAsync(target.Id);
        Assert.NotNull(stale);

        using (var response = await SetStatusAsync(admin, target.Id, "Suspended"))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        stale.AccessFailedCount++;
        var result = await userManager.UpdateAsync(stale);

        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, error => error.Code == nameof(IdentityErrorDescriber.ConcurrencyFailure));
        Assert.Equal(AccountStatus.Suspended, (await StoredAsync(factory, target.Id)).AccountStatus);
    }
}
