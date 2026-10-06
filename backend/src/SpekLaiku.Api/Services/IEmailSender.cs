using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

public interface IEmailSender
{
    Task SendEmailConfirmationAsync(ApplicationUser user, string token, CancellationToken cancellationToken = default);
}
