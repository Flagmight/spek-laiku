using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpekLaiku.Api.Authorization;
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
}
