using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Mapping;

/// <summary>Plan setup results to the response objects in contracts/plan-setup-api.md. No rules here.</summary>
public sealed class PlanSetupMappingProfile : Profile
{
    public PlanSetupMappingProfile()
    {
        CreateMap<PlaceLocation, LocationResponse>();
        CreateMap<CheckedPlanSetup, CheckedPlanSetupResponse>();
    }
}
