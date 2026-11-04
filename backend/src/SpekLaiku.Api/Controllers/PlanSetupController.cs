using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SpekLaiku.Api.Authorization;
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
public sealed class PlanSetupController(ForecastPeriod forecastPeriod) : ControllerBase
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
}
