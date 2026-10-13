namespace SpekLaiku.Api.Clients;

public sealed class SendGridOptions
{
    public const string SectionName = "SendGrid";

    public string ApiKey { get; set; } = string.Empty;
}
