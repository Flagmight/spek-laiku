using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.RateLimiting;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Controllers;

// Visitors and Active Registered Users only (spec FR-001, FR-002). Every request may reach the location search
// and map data services, so it shares the plan setup request limit with location searches, plan setup checks
// and forecast requests (spec FR-011).
[ApiController]
[Route("api/plan-places")]
[Authorize(Policy = AuthorizationPolicies.PlanCreator)]
[EnableRateLimiting(RateLimitPolicies.PlanSetup)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public sealed class PlanPlacesController(PlanPlacesService planPlacesService, IMapper mapper) : ControllerBase
{
    // A failure of either external service becomes 503 in ApiExceptionHandler.
    [HttpPost]
    [ProducesResponseType<PlanPlacesResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<PlanPlacesResponse>> Get(
        PlanPlacesRequest request,
        CancellationToken cancellationToken)
    {
        var result = await planPlacesService.GetAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            // The keys keep the order of the check that failed: setup.* or activities*.
            var errors = result.Errors.ToDictionary(error => error.Key, error => new[] { error.Value });
            return BadRequest(new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more request fields are invalid."
            });
        }

        return mapper.Map<PlanPlacesResponse>(result.Places);
    }
}
