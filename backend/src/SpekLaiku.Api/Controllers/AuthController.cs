using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    CurrentUserService currentUserService,
    LoginService loginService,
    SignInManager<ApplicationUser> signInManager,
    IMapper mapper) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<CurrentUserResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await loginService.LoginAsync(request, cancellationToken);
        if (result.Succeeded)
        {
            await signInManager.SignInAsync(result.User, isPersistent: false);
            return mapper.Map<CurrentUserResponse>(result.User);
        }

        if (result.IsIncorrectCredentials)
        {
            // The same answer for an unknown email, a wrong password and a locked account (FR-004).
            return Problem(
                title: "Incorrect email or password.",
                detail: "Incorrect email or password.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var errors = result.Errors.ToDictionary(error => error.Key, error => new[] { error.Value });
        return BadRequest(new ValidationProblemDetails(errors)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more request fields are invalid."
        });
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CurrentUserResponse>> GetCurrentUser()
    {
        var user = await currentUserService.GetAsync(User);
        if (user is null)
        {
            return Challenge();
        }

        return mapper.Map<CurrentUserResponse>(user);
    }
}
