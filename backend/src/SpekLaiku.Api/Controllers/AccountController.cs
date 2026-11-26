using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Controllers;

/// <summary>
/// The signed-in user's own account (feature 016 contracts/account-deletion-api.md). Only an Active Registered User
/// gets past the policy: a Visitor gets 401, any other signed-in account 403. No request names an account.
/// </summary>
[ApiController]
[Route("api/account")]
[Authorize(Policy = AuthorizationPolicies.ActiveRegisteredUser)]
public sealed class AccountController(
    AccountDeletionService accountDeletionService,
    SignInManager<ApplicationUser> signInManager) : ControllerBase
{
    private const string LockedOutMessage = "Too many incorrect passwords. Try again in 15 minutes.";

    // POST rather than DELETE, because the request carries the password in its body (research section 2).
    [HttpPost("delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Delete(AccountDeletionRequest request, CancellationToken cancellationToken)
    {
        var result = await accountDeletionService.DeleteAsync(User, request, cancellationToken);
        switch (result.Outcome)
        {
            case AccountDeletionOutcome.Deleted:
                // The same answer removes the session cookie, so no second request can fail (research section 6).
                await signInManager.SignOutAsync();
                return NoContent();
            case AccountDeletionOutcome.Invalid:
                return FieldErrors(result.Errors);
            case AccountDeletionOutcome.IncorrectPassword:
                return FieldErrors(new Dictionary<string, string> { ["password"] = "Password is incorrect." });
            case AccountDeletionOutcome.LockedOut:
                return Problem(
                    title: LockedOutMessage,
                    detail: LockedOutMessage,
                    statusCode: StatusCodes.Status429TooManyRequests);
            default:
                // The same empty 403 as a refused policy: the account changed after the request started.
                return Forbid();
        }
    }

    private BadRequestObjectResult FieldErrors(IReadOnlyDictionary<string, string> errors) =>
        BadRequest(new ValidationProblemDetails(errors.ToDictionary(error => error.Key, error => new[] { error.Value }))
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more request fields are invalid."
        });
}
