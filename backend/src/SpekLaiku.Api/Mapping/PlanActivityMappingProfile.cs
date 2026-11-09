using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Mapping;

public sealed class PlanActivityMappingProfile : Profile
{
    public PlanActivityMappingProfile()
    {
        CreateMap<ActivityCategory, PlanCategoryResponse>()
            .ForCtorParam(nameof(PlanCategoryResponse.Type), options => options.MapFrom(source => source.Type.ToString()));

        CreateMap<CheckedPlanActivity, CheckedPlanActivityResponse>()
            .ForCtorParam(nameof(CheckedPlanActivityResponse.Type), options => options.MapFrom(source => source.Type.ToString()));
    }
}
