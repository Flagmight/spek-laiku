using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.RateLimiting;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Controllers;

// Visitors and Active Registered Users may search (spec FR-003); searches count towards the plan setup
// request limit (spec FR-027). A service failure becomes 503 in ApiExceptionHandler.
[ApiController]
[Route("api/locations")]
[Authorize(Policy = AuthorizationPolicies.PlanCreator)]
[EnableRateLimiting(RateLimitPolicies.PlanSetup)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
public sealed class LocationsController(LocationSearchService locationSearchService, IMapper mapper) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<LocationSearchResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<LocationSearchResponse>> Search(
        [FromQuery] string? query,
        CancellationToken cancellationToken)
    {
        var result = await locationSearchService.SearchAsync(query, cancellationToken);
        if (!result.Succeeded)
        {
            var errors = result.Errors.ToDictionary(error => error.Key, error => new[] { error.Value });
            return BadRequest(new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more request fields are invalid."
            });
        }

        return new LocationSearchResponse(mapper.Map<LocationResponse[]>(result.Locations));
    }
}
