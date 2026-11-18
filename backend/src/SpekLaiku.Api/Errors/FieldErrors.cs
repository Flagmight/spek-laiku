using Microsoft.AspNetCore.Mvc;

namespace SpekLaiku.Api.Errors;

/// <summary>
/// Turns a service's field errors into the API's 400 validation problem, so every endpoint that uses it answers in
/// the same shape: one entry per field, with every message for that field in order.
/// </summary>
public static class FieldErrors
{
    public static ValidationProblemDetails ToValidationProblem(
        this IEnumerable<KeyValuePair<string, string>> errors) =>
        new(errors
            .GroupBy(error => error.Key)
            .ToDictionary(group => group.Key, group => group.Select(error => error.Value).ToArray()))
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more request fields are invalid."
        };
}
