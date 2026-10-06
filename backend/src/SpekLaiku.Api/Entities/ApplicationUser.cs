using Microsoft.AspNetCore.Identity;

namespace SpekLaiku.Api.Entities;

public class ApplicationUser : IdentityUser
{
    public string Role { get; set; } = "Registered User";
    public AccountStatus AccountStatus { get; set; }
    public override bool EmailConfirmed { get; set; }
    public DateTime RegistrationDate { get; set; }
    public DateTime? VerificationSentAt { get; set; }
    public DateTime? VerificationAttemptedAt { get; set; }
}
