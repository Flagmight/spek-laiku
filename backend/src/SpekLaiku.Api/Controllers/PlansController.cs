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
            var errors = result.Errors
                .GroupBy(error => error.Key)
                .ToDictionary(group => group.Key, group => group.Select(error => error.Value).ToArray());
            return BadRequest(new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more request fields are invalid."
            });
        }

        var summary = mapper.Map<SavedPlanSummaryResponse>(result.Plan);
        return result.Outcome == SavePlanOutcome.Created
            ? Created($"/api/plans/{result.Plan.Id}", summary)
            : Ok(summary);
    }
}
