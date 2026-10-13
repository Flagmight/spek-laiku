using System.Net;
using System.Text.Encodings.Web;
using Microsoft.Extensions.Options;
using SendGrid;
using SendGrid.Helpers.Mail;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Clients;

public sealed class SendGridEmailSender(
    ISendGridClient sendGridClient,
    IOptions<SendGridOptions> sendGridOptions,
    IOptions<EmailOptions> emailOptions,
    ILogger<SendGridEmailSender> logger) : IEmailSender
{
    public async Task SendEmailConfirmationAsync(
        ApplicationUser user,
        string token,
        CancellationToken cancellationToken = default)
    {
        var sendGridSettings = sendGridOptions.Value;
        var emailSettings = emailOptions.Value;
        if (string.IsNullOrWhiteSpace(sendGridSettings.ApiKey)
            || string.IsNullOrWhiteSpace(emailSettings.FromAddress)
            || !Uri.TryCreate(emailSettings.VerificationBaseUrl, UriKind.Absolute, out var verificationBaseUri)
            || (verificationBaseUri.Scheme != Uri.UriSchemeHttps
                && !(verificationBaseUri.Scheme == Uri.UriSchemeHttp && verificationBaseUri.IsLoopback))
            || !string.IsNullOrEmpty(verificationBaseUri.Fragment)
            || string.IsNullOrWhiteSpace(user.Email))
        {
            throw new InvalidOperationException("SendGrid email settings are incomplete.");
        }

        var verificationUrl = new UriBuilder(verificationBaseUri)
        {
            Query = $"userId={Uri.EscapeDataString(user.Id)}&token={Uri.EscapeDataString(token)}"
        }.Uri.AbsoluteUri;
        var message = MailHelper.CreateSingleEmail(
            new EmailAddress(emailSettings.FromAddress, "Spėk laiku"),
            new EmailAddress(user.Email),
            "Confirm your email address",
            $"Confirm your email address by opening this link: {verificationUrl}",
            $"<p>Confirm your email address to finish creating your account.</p><p><a href=\"{HtmlEncoder.Default.Encode(verificationUrl)}\">Confirm email address</a></p>");

        var response = await sendGridClient.SendEmailAsync(message, cancellationToken);
        if (response.StatusCode is < HttpStatusCode.OK or >= HttpStatusCode.MultipleChoices)
        {
            logger.LogWarning(
                "SendGrid rejected a confirmation email with status code {StatusCode}",
                (int)response.StatusCode);
            throw new InvalidOperationException("The confirmation email could not be sent.");
        }
    }
}
