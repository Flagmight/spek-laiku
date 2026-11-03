using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Controllers;

// Every action needs an Active Administrator; others get 401 or 403 before the body is read
// (contracts/categories-api.md).
[ApiController]
[Route("api/admin/categories")]
[Authorize(Policy = AuthorizationPolicies.ActiveAdministrator)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status500InternalServerError)]
public sealed class AdminCategoriesController(ActivityCategoryService categoryService, IMapper mapper)
    : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<ActivityCategoryResponse[]>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ActivityCategoryResponse[]>> List(CancellationToken cancellationToken)
    {
        var categories = await categoryService.ListAsync(cancellationToken);
        return mapper.Map<ActivityCategoryResponse[]>(categories);
    }

    [HttpPost]
    [ProducesResponseType<ActivityCategoryResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ActivityCategoryResponse>> Create(
        ActivityCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.CreateAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            return FieldErrors(result.Errors);
        }

        var response = mapper.Map<ActivityCategoryResponse>(result.Category);
        // US2 adds the GET {id} action; then this becomes CreatedAtAction.
        return Created($"/api/admin/categories/{response.Id}", response);
    }

    private BadRequestObjectResult FieldErrors(IReadOnlyDictionary<string, string> errors) =>
        BadRequest(new ValidationProblemDetails(errors.ToDictionary(error => error.Key, error => new[] { error.Value }))
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more request fields are invalid."
        });
}
