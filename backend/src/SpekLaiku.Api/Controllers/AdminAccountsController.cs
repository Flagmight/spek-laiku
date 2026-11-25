using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Controllers;

// Every action needs an Active Administrator; others get 401 or 403 before the query or body is read, so a refused
// caller never learns whether an account exists (feature 014 contracts/admin-accounts-api.md).
[ApiController]
[Route("api/admin/accounts")]
[Authorize(Policy = AuthorizationPolicies.ActiveAdministrator)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError)]
public sealed class AdminAccountsController(
    AdminAccountService accountService,
    UserManager<ApplicationUser> userManager,
    IMapper mapper) : ControllerBase
{
    private const string InvalidStatusMessage = "Select Active or Suspended.";

    [HttpGet]
    [ProducesResponseType<AdminAccountListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminAccountListResponse>> List(
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var listing = await accountService.ListAsync(string.Empty, cancellationToken);
        return mapper.Map<AdminAccountListResponse>(listing);
    }

    [HttpPut("{id}/status")]
    [ProducesResponseType<AdminAccountResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AdminAccountResponse>> SetStatus(
        string id,
        AccountStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (ParseStatus(request.AccountStatus) is not { } status)
        {
            return FieldError("accountStatus", InvalidStatusMessage);
        }

        var change = await accountService.SetStatusAsync(userManager.GetUserId(User)!, id, status, cancellationToken);
        return change.Outcome switch
        {
            AccountStatusChangeOutcome.NotFound => Problem(
                title: "Not found.", detail: "This account no longer exists.", statusCode: StatusCodes.Status404NotFound),
            AccountStatusChangeOutcome.AdministratorAccount => Problem(
                title: "Administrator account.",
                detail: "Administrator accounts cannot be suspended or reactivated here.",
                statusCode: StatusCodes.Status409Conflict),
            _ => mapper.Map<AdminAccountResponse>(change.Account),
        };
    }

    // Exactly "Active" or "Suspended": Enum.TryParse would also accept "1" or "suspended".
    private static AccountStatus? ParseStatus(string? value) => value switch
    {
        nameof(AccountStatus.Active) => AccountStatus.Active,
        nameof(AccountStatus.Suspended) => AccountStatus.Suspended,
        _ => null,
    };

    private BadRequestObjectResult FieldError(string field, string message) =>
        BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]> { [field] = [message] })
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more request fields are invalid."
        });
}
