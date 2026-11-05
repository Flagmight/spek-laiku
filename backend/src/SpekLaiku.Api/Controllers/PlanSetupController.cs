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

// Visitors and Active Registered Users only (spec FR-003). Actions that may reach the location search
// service count towards the plan setup request limit (spec FR-027).
[ApiController]
[Route("api/plan-setup")]
[Authorize(Policy = AuthorizationPolicies.PlanCreator)]
[EnableRateLimiting(RateLimitPolicies.PlanSetup)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public sealed class PlanSetupController(
    ForecastPeriod forecastPeriod,
    PlanSetupService planSetupService,
    IMapper mapper) : ControllerBase
{
    // Makes no external call, so it is not limited (contracts/plan-setup-api.md).
    [HttpGet("period")]
    [DisableRateLimiting]
    [ProducesResponseType<PlanPeriodResponse>(StatusCodes.Status200OK)]
    public ActionResult<PlanPeriodResponse> GetPeriod()
    {
        var (firstDate, lastDate) = forecastPeriod.GetCurrent();
        return new PlanPeriodResponse(firstDate, lastDate, PlanSetupValidator.MaxDates);
    }

    // A failure of the location search service becomes 503 in ApiExceptionHandler.
    [HttpPost("check")]
    [ProducesResponseType<CheckedPlanSetupResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<CheckedPlanSetupResponse>> Check(
        PlanSetupCheckRequest request,
        CancellationToken cancellationToken)
    {
        var result = await planSetupService.CheckAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            // The keys keep the contract order: locationId, dates, dates[i], maxTravelDistanceKm.
            var errors = result.Errors.ToDictionary(error => error.Key, error => new[] { error.Value });
            return BadRequest(new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more request fields are invalid."
            });
        }

        return mapper.Map<CheckedPlanSetupResponse>(result.Setup);
    }
}
