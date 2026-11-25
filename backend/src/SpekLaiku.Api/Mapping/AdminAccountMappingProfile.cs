using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Mapping;

/// <summary>
/// Maps the administrator's view of an account (feature 014 contracts/admin-accounts-api.md). Only the five members of
/// <see cref="AdminAccountSummary"/> may ever be mapped, and there is deliberately no map from ApplicationUser, so an
/// entity with its password hash and stamps cannot reach a response by mistake (spec FR-011).
/// </summary>
public sealed class AdminAccountMappingProfile : Profile
{
    public AdminAccountMappingProfile()
    {
        CreateMap<AdminAccountSummary, AdminAccountResponse>()
            .ForCtorParam(nameof(AdminAccountResponse.Id), options => options.MapFrom(source => source.Id))
            .ForCtorParam(nameof(AdminAccountResponse.Email), options => options.MapFrom(source => source.Email))
            .ForCtorParam(nameof(AdminAccountResponse.Role), options => options.MapFrom(source => source.Role))
            .ForCtorParam(
                nameof(AdminAccountResponse.AccountStatus),
                options => options.MapFrom(source => source.AccountStatus.ToString()))
            .ForCtorParam(
                nameof(AdminAccountResponse.RegistrationDate),
                options => options.MapFrom(source => source.RegistrationDate));
    }
}
