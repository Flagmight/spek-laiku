using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Controllers;

// Visitors and Active Registered Users only (spec FR-001, FR-002). No request limit: the plan setup limit
// protects the location search service, and these actions call no external service (research section 8).
[ApiController]
[Route("api/plan-activities")]
[Authorize(Policy = AuthorizationPolicies.PlanCreator)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public sealed class PlanActivitiesController(PlanActivityService planActivityService, IMapper mapper) : ControllerBase
{
    [HttpGet("categories")]
    [ProducesResponseType<PlanCategoriesResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PlanCategoriesResponse>> ListCategories(CancellationToken cancellationToken)
    {
        var categories = await planActivityService.ListCategoriesAsync(cancellationToken);
        return new PlanCategoriesResponse(
            mapper.Map<PlanCategoryResponse[]>(categories),
            PlanActivityValidator.MaxActivities);
    }

    [HttpPost("check")]
    [ProducesResponseType<CheckedPlanActivitiesResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CheckedPlanActivitiesResponse>> Check(
        PlanActivitiesCheckRequest request,
        CancellationToken cancellationToken)
    {
        var result = await planActivityService.CheckAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            // The keys keep the order given in data-model.md (Validation rules).
            var errors = result.Errors.ToDictionary(error => error.Key, error => new[] { error.Value });
            return BadRequest(new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more request fields are invalid."
            });
        }

        return new CheckedPlanActivitiesResponse(mapper.Map<CheckedPlanActivityResponse[]>(result.Activities));
    }
}
