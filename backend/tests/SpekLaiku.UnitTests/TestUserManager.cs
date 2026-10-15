using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
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
        null,
        new PasswordHasher<ApplicationUser>(),
        [],
        [],
        new UpperInvariantLookupNormalizer(),
        new IdentityErrorDescriber(),
        null!,
        NullLogger<UserManager<ApplicationUser>>.Instance)
{
    public override Task<IdentityResult> CreateAsync(ApplicationUser user, string password) =>
        Task.FromResult(createAsync());
}
