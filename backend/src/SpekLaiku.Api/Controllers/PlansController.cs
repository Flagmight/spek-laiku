using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Errors;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Controllers;

// Saved plans belong to Active Registered Users only (feature 010 spec FR-012): a Visitor gets 401 and any other
// signed-in account 403. The owner is always the signed-in user, never a value from the request (spec FR-013).
[ApiController]
[Route("api/plans")]
[Authorize(Policy = AuthorizationPolicies.ActiveRegisteredUser)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public sealed class PlansController(
    SavedPlanService savedPlanService,
    UserManager<ApplicationUser> userManager,
    IMapper mapper) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<List<SavedPlanSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<SavedPlanSummaryResponse>>> List(CancellationToken cancellationToken)
    {
        var plans = await savedPlanService.ListAsync(userManager.GetUserId(User)!, cancellationToken);
        return mapper.Map<List<SavedPlanSummaryResponse>>(plans);
    }

    // Another user's plan gives 403 through the cookie handler, with the standard problem body and no plan data
    // (spec FR-012, clarification Q4); a plan that does not exist gives 404.
    [HttpGet("{id:guid}")]
    [ProducesResponseType<SavedPlanResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SavedPlanResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var lookup = await savedPlanService.GetAsync(userManager.GetUserId(User)!, id, cancellationToken);
        if (lookup.Found)
        {
            return mapper.Map<SavedPlanResponse>(lookup.Plan);
        }

        if (lookup.IsForbidden)
        {
            return Forbid();
        }

        return NotFound(new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Title = "Not found.",
            Detail = "This plan no longer exists."
        });
    }

    [HttpPost]
    [ProducesResponseType<SavedPlanSummaryResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<SavedPlanSummaryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SavedPlanSummaryResponse>> Save(
        SavePlanRequest request,
        CancellationToken cancellationToken)
    {
        var result = await savedPlanService.SaveAsync(userManager.GetUserId(User)!, request, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.ToValidationProblem());
        }

        var summary = mapper.Map<SavedPlanSummaryResponse>(result.Plan);
        return result.Outcome == SavePlanOutcome.Created
            ? CreatedAtAction(nameof(Get), new { id = result.Plan.Id }, summary)
            : Ok(summary);
    }
}
