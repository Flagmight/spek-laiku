using Microsoft.AspNetCore.Identity;

namespace SpekLaiku.Api.Entities;

public class ApplicationUser : IdentityUser
{
    public string Role { get; set; } = "Registered User";
    public AccountStatus AccountStatus { get; set; } = AccountStatus.Active;
    public DateTime RegistrationDate { get; set; }
}
