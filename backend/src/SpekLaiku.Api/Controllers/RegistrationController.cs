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
[Route("api/registration")]
public sealed class RegistrationController(
    RegistrationService registrationService,
    SignInManager<ApplicationUser> signInManager,
    IMapper mapper) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost]
    [ProducesResponseType<RegistrationResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<RegistrationResponse>> Register(
        RegistrationRequest request,
        CancellationToken cancellationToken)
    {
        // A signed-in user must not create a second account (FR-014), whatever the request contains.
        if (User.Identity?.IsAuthenticated == true)
        {
            return Problem(
                title: "Already signed in.",
                detail: "You are already signed in.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        var result = await registrationService.RegisterAsync(request, cancellationToken);
        if (result.Succeeded)
        {
            // The same non-persistent session cookie that the Login feature (002) issues.
            await signInManager.SignInAsync(result.User, isPersistent: false);
            return StatusCode(StatusCodes.Status201Created, mapper.Map<RegistrationResponse>(result));
        }

        if (result.IsTechnicalFailure)
        {
            return Problem(
                title: "Something went wrong.",
                detail: "Something went wrong. Try again.",
                statusCode: StatusCodes.Status500InternalServerError);
        }

        var errors = result.Errors.ToDictionary(error => error.Key, error => new[] { error.Value });
        return BadRequest(new ValidationProblemDetails(errors)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more request fields are invalid."
        });
    }
}
