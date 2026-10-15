using Microsoft.AspNetCore.Identity;

namespace SpekLaiku.Api.Data;

/// <summary>
/// The application's Identity rules, shared with the tests so they check the same rules as production.
/// </summary>
public static class IdentityOptionsSetup
{
    public static void Configure(IdentityOptions options)
    {
        options.User.RequireUniqueEmail = true;
        // Any email the registration service accepts must also be a valid user name (FR-003).
        options.User.AllowedUserNameCharacters = string.Empty;
        // The only password rule is a minimum of 8 characters (FR-005).
        options.Password.RequiredLength = 8;
        options.Password.RequiredUniqueChars = 1;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
    }
}
