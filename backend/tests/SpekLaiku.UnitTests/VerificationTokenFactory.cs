using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

public static class VerificationTokenFactory
{
    public static Task<string> CreateTokenAsync(this VerificationService service, ApplicationUser user)
        => service.CreateTokenAsync(user);
}
