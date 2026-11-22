using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Errors;
using SpekLaiku.Api.RateLimiting;
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
    SavedPlanChangeService savedPlanChangeService,
    SavedPlanEditService savedPlanEditService,
    PlanCheckService planCheckService,
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

        return lookup.IsForbidden ? Forbid() : PlanNotFound();
    }

    // Checks the plan against the latest forecast and changes nothing (feature 012 spec FR-002, FR-014). Shares the
    // plan setup request limit (FR-015); a weather failure becomes 503 in ApiExceptionHandler.
    [HttpGet("{id:guid}/check")]
    [EnableRateLimiting(RateLimitPolicies.PlanSetup)]
    [ProducesResponseType<PlanCheckResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<PlanCheckResponse>> Check(Guid id, CancellationToken cancellationToken)
    {
        var result = await planCheckService.CheckAsync(userManager.GetUserId(User)!, id, cancellationToken);
        if (result.Found)
        {
            return mapper.Map<PlanCheckResponse>(result.Check);
        }

        return result.IsForbidden ? Forbid() : PlanNotFound();
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

    // Deletes the plan permanently; the browser asks for confirmation first (feature 011 spec FR-001, FR-002).
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(
            await savedPlanChangeService.DeleteAsync(userManager.GetUserId(User)!, id, cancellationToken));

    // Copies the plan under the signed-in user; there is no body, so no owner can be sent (feature 011 spec FR-004,
    // FR-016).
    [HttpPost("{id:guid}/copies")]
    [ProducesResponseType<SavedPlanSummaryResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> Duplicate(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(
            await savedPlanChangeService.DuplicateAsync(userManager.GetUserId(User)!, id, cancellationToken),
            copy => CreatedAtAction(nameof(Get), new { id = copy.Id }, mapper.Map<SavedPlanSummaryResponse>(copy)));

    // Saves changes from an edit: replaces the plan with a schedule the server generated, keeping its address. The
    // body is the same as for saving a new plan (feature 011 spec FR-010, FR-011).
    [HttpPut("{id:guid}")]
    [ProducesResponseType<SavedPlanSummaryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> Replace(Guid id, SavePlanRequest request, CancellationToken cancellationToken) =>
        ToActionResult(
            await savedPlanEditService.ReplaceAsync(userManager.GetUserId(User)!, id, request, cancellationToken),
            plan => Ok(mapper.Map<SavedPlanSummaryResponse>(plan)));

    // Renames the plan; the schedule and the saved time are not changed (feature 011 spec FR-014).
    [HttpPut("{id:guid}/name")]
    [ProducesResponseType<SavedPlanSummaryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> Rename(Guid id, RenamePlanRequest request, CancellationToken cancellationToken) =>
        ToActionResult(
            await savedPlanEditService.RenameAsync(userManager.GetUserId(User)!, id, request, cancellationToken),
            plan => Ok(mapper.Map<SavedPlanSummaryResponse>(plan)));

    // The HTTP answer for a change to a saved plan (feature 011 contracts/plans-api.md). Another user's plan gives
    // 403 through the cookie handler, with no plan data; onChanged builds the success answer from the plan.
    private ActionResult ToActionResult(SavedPlanChange change, Func<SavedPlan, ActionResult>? onChanged = null) =>
        change.Outcome switch
        {
            SavedPlanChangeOutcome.Invalid => BadRequest(change.Errors.ToValidationProblem()),
            SavedPlanChangeOutcome.NotFound => PlanNotFound(),
            SavedPlanChangeOutcome.Forbidden => Forbid(),
            SavedPlanChangeOutcome.Deleted => NoContent(),
            _ when change.HasPlan && onChanged is not null => onChanged(change.Plan),
            _ => throw new InvalidOperationException("A changed plan result needs the plan and a success answer."),
        };

    private NotFoundObjectResult PlanNotFound() =>
        NotFound(new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Title = "Not found.",
            Detail = "This plan no longer exists."
        });
}
