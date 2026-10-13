using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Mapping;

public sealed class RegistrationMappingProfile : Profile
{
    public RegistrationMappingProfile()
    {
        CreateMap<RegistrationResult, RegistrationResponse>()
            .ForCtorParam(nameof(RegistrationResponse.Success), options => options.MapFrom(source => source.Succeeded))
            .ForCtorParam(
                nameof(RegistrationResponse.Message),
                options => options.MapFrom(source => source.Succeeded
                    ? "Account created. Verify your email to continue."
                    : source.ErrorMessage ?? "Account could not be created. Try again later."))
            .ForCtorParam(
                nameof(RegistrationResponse.AccountStatus),
                options => options.MapFrom(source => source.Succeeded
                    ? AccountStatus.PendingVerification.ToString()
                    : null));

        CreateMap<VerificationResult, VerificationResponse>()
            .ForCtorParam(nameof(VerificationResponse.Success), options => options.MapFrom(source => source.Succeeded))
            .ForCtorParam(
                nameof(VerificationResponse.Message),
                options => options.MapFrom(source => source.Succeeded
                    ? "Email address verified."
                    : source.ErrorMessage ?? "The verification link is invalid."));
    }
}
