using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.UnitTests;

/// <summary>
/// A <see cref="UserManager{TUser}"/> over a real store whose <c>CreateAsync</c> is replaced,
/// so tests can simulate Identity and database failures during account creation.
/// </summary>
public sealed class TestUserManager(ApplicationDbContext context, Func<IdentityResult> createAsync)
    : UserManager<ApplicationUser>(
        new UserStore<ApplicationUser>(context),
        Microsoft.Extensions.Options.Options.Create(ApplicationIdentityOptions()),
        new PasswordHasher<ApplicationUser>(),
        [],
        [],
        new UpperInvariantLookupNormalizer(),
        new IdentityErrorDescriber(),
        new ServiceCollection().BuildServiceProvider(),
        NullLogger<UserManager<ApplicationUser>>.Instance)
{
    private static IdentityOptions ApplicationIdentityOptions()
    {
        var options = new IdentityOptions();
        IdentityOptionsSetup.Configure(options);
        return options;
    }

    public override Task<IdentityResult> CreateAsync(ApplicationUser user, string password) =>
        Task.FromResult(createAsync());
}
