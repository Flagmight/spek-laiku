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
        return CreatedAtAction(nameof(Get), new { id = response.Id }, response);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<ActivityCategoryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ActivityCategoryResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var category = await categoryService.GetAsync(id, cancellationToken);
        return category is null ? CategoryNotFound() : mapper.Map<ActivityCategoryResponse>(category);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType<ActivityCategoryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ActivityCategoryResponse>> Update(
        Guid id,
        UpdateActivityCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.UpdateAsync(id, request, cancellationToken);
        if (result.Succeeded)
        {
            return mapper.Map<ActivityCategoryResponse>(result.Category);
        }

        if (result.IsNotFound)
        {
            return CategoryNotFound();
        }

        if (result.IsConflict)
        {
            const string message = "This category was changed by someone else. Reload it and try again.";
            return Problem(title: message, detail: message, statusCode: StatusCodes.Status409Conflict);
        }

        return FieldErrors(result.Errors);
    }

    private ObjectResult CategoryNotFound() =>
        Problem(title: "Category not found.", detail: "Category not found.", statusCode: StatusCodes.Status404NotFound);

    private BadRequestObjectResult FieldErrors(IReadOnlyDictionary<string, string> errors) =>
        BadRequest(new ValidationProblemDetails(errors.ToDictionary(error => error.Key, error => new[] { error.Value }))
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more request fields are invalid."
        });
}
