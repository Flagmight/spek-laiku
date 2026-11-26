using System.Net;
using static SpekLaiku.IntegrationTests.AccountDeletionRequests;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// The password check of <c>POST /api/account/delete</c> and the login lock it shares with Log in (feature 016 spec
/// FR-002, FR-016, research section 4): 5 wrong passwords in a row, in the dialog or on Log in, lock the account for
/// 15 minutes.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class AccountDeletionPasswordTests(PostgreSqlApiFactory factory)
{
    private const string WrongPassword = "Wrong-password-1";
    private const string LockedMessage = "Too many incorrect passwords. Try again in 15 minutes.";

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task EmptyPassword_Gets400AndCountsNoAttempt(string? password)
    {
        var (user, client) = await factory.CreateSignedInUserAsync();

        using var response = await DeleteAccountAsync(client, password);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["Enter your password."], await PasswordErrorsAsync(response));
        Assert.Equal(0, (await LockStateAsync(factory, user.Id)).AccessFailedCount);
    }

    [Fact]
    public async Task WrongPassword_Gets400PasswordIsIncorrect()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        await SeedPlanAsync(factory, user.Id);

        using var response = await DeleteAccountAsync(client, WrongPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["Password is incorrect."], await PasswordErrorsAsync(response));
        Assert.Equal(1, (await LockStateAsync(factory, user.Id)).AccessFailedCount);
        Assert.True(await AccountExistsAsync(factory, user.Id));
        Assert.Equal(1, await PlanCountAsync(factory, user.Id));
    }

    [Theory]
    [InlineData(Password + " ")]
    [InlineData(" " + Password)]
    public async Task PasswordWithAddedSpace_IsWrong(string password)
    {
        var (user, client) = await factory.CreateSignedInUserAsync();

        using var response = await DeleteAccountAsync(client, password);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["Password is incorrect."], await PasswordErrorsAsync(response));
        Assert.True(await AccountExistsAsync(factory, user.Id));
    }

    [Fact]
    public async Task FifthWrongPassword_Gets429AndLocksTheAccount()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            using var wrong = await DeleteAccountAsync(client, WrongPassword);
            Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        }

        using var fifth = await DeleteAccountAsync(client, WrongPassword);

        Assert.Equal((HttpStatusCode)429, fifth.StatusCode);
        Assert.Equal(LockedMessage, (await ReadAsync(fifth)).GetProperty("detail").GetString());
        var (_, lockoutEnd) = await LockStateAsync(factory, user.Id);
        Assert.NotNull(lockoutEnd);
        Assert.InRange(lockoutEnd.Value, DateTimeOffset.UtcNow.AddMinutes(14), DateTimeOffset.UtcNow.AddMinutes(16));
    }

    [Fact]
    public async Task WhileLocked_CorrectPasswordGets429AndDeletesNothing()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        await SeedPlanAsync(factory, user.Id);
        await LockByDialogAsync(client);

        using var response = await DeleteAccountAsync(client);

        Assert.Equal((HttpStatusCode)429, response.StatusCode);
        Assert.Equal(LockedMessage, (await ReadAsync(response)).GetProperty("detail").GetString());
        Assert.True(await AccountExistsAsync(factory, user.Id));
        Assert.Equal(1, await PlanCountAsync(factory, user.Id));
        // The user stays signed in.
        using var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task LockIsShared_WrongLoginsCountInTheDialog()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, await LoginAsync(factory, user.Email!, WrongPassword));
        }

        using var response = await DeleteAccountAsync(client, WrongPassword);

        Assert.Equal((HttpStatusCode)429, response.StatusCode);
        Assert.True(await AccountExistsAsync(factory, user.Id));
    }

    [Fact]
    public async Task LockIsShared_DialogLockRefusesLogin()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        await LockByDialogAsync(client);

        Assert.Equal(HttpStatusCode.Unauthorized, await LoginAsync(factory, user.Email!, Password));
    }

    private static async Task LockByDialogAsync(HttpClient client)
    {
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            using var wrong = await DeleteAccountAsync(client, WrongPassword);
        }
    }
}
