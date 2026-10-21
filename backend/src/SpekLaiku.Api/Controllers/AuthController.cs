using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(CurrentUserService currentUserService, IMapper mapper) : ControllerBase
{
    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CurrentUserResponse>> GetCurrentUser()
    {
        var user = await currentUserService.GetAsync(User);
        if (user is null)
        {
            return Challenge();
        }

        return mapper.Map<CurrentUserResponse>(user);
    }
}
