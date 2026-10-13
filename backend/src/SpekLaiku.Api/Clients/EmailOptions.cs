namespace SpekLaiku.Api.Clients;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string FromAddress { get; set; } = string.Empty;

    public string VerificationBaseUrl { get; set; } = string.Empty;
}
