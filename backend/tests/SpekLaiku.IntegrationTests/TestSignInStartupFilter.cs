using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Adds a test-only endpoint that signs in an existing user through the real SignInManager,
/// so tests get the same cookie the application issues. The Login feature (002) replaces it.
/// </summary>
public sealed class TestSignInStartupFilter : IStartupFilter
{
    public const string Path = "/test/sign-in";

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        // A path check instead of app.Map: Map sets PathBase, which would become the cookie path.
        app.Use(async (context, nextMiddleware) =>
        {
            if (context.Request.Path != Path)
            {
                await nextMiddleware(context);
                return;
            }

            var email = context.Request.Query["email"].ToString();
            var userManager = context.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByEmailAsync(email);
            if (user is null)
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            var signInManager = context.RequestServices.GetRequiredService<SignInManager<ApplicationUser>>();
            await signInManager.SignInAsync(user, isPersistent: false);
            context.Response.StatusCode = StatusCodes.Status204NoContent;
        });
        next(app);
    };
}
