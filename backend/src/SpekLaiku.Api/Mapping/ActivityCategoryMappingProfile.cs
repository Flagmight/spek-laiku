using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Mapping;

public sealed class ActivityCategoryMappingProfile : Profile
{
    public ActivityCategoryMappingProfile()
    {
        CreateMap<ActivityCategory, ActivityCategoryResponse>()
            .ForCtorParam(nameof(ActivityCategoryResponse.Type), options => options.MapFrom(source => source.Type.ToString()));
    }
}
