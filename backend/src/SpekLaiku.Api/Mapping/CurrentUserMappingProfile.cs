using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Mapping;

public sealed class CurrentUserMappingProfile : Profile
{
    public CurrentUserMappingProfile()
    {
        CreateMap<ApplicationUser, CurrentUserResponse>()
            .ForCtorParam(nameof(CurrentUserResponse.Email), options => options.MapFrom(source => source.Email ?? string.Empty))
            .ForCtorParam(nameof(CurrentUserResponse.Role), options => options.MapFrom(source => source.Role))
            .ForCtorParam(
                nameof(CurrentUserResponse.AccountStatus),
                options => options.MapFrom(source => source.AccountStatus.ToString()));
    }
}
