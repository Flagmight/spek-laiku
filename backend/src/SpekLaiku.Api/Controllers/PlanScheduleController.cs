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

// Visitors and Active Registered Users only (spec FR-001, FR-002). Every request contacts the forecast and
// map data services, so it shares the plan setup request limit (spec FR-008).
[ApiController]
[Route("api/plan-schedule")]
[Authorize(Policy = AuthorizationPolicies.PlanCreator)]
[EnableRateLimiting(RateLimitPolicies.PlanSetup)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public sealed class PlanScheduleController(PlanScheduleService planScheduleService, IMapper mapper) : ControllerBase
{
    // A failure of either external service becomes 503 in ApiExceptionHandler.
    [HttpPost]
    [ProducesResponseType<PlanScheduleResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<PlanScheduleResponse>> Get(
        PlanScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var result = await planScheduleService.GetAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            var errors = result.Errors.ToDictionary(error => error.Key, error => new[] { error.Value });
            return BadRequest(new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more request fields are invalid."
            });
        }

        return mapper.Map<PlanScheduleResponse>(result.Schedule);
    }
}
