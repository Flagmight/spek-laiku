using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Mapping;

/// <summary>
/// The plan places to the response objects in contracts/plan-places-api.md. No rules here. The response has no
/// field for <see cref="NearbyPlace.Key"/>, so the map element's id never reaches the browser. The
/// <c>TimeOnly</c> to "HH:mm" conversion is the one in <see cref="PlanForecastMappingProfile"/>, which applies
/// to every profile; a second one would fail the configuration check.
/// </summary>
public sealed class PlanPlacesMappingProfile : Profile
{
    public PlanPlacesMappingProfile()
    {
        CreateMap<PlanPlaces, PlanPlacesResponse>();
        CreateMap<CategoryPlaces, CategoryPlacesResponse>();
        CreateMap<NearbyPlace, NearbyPlaceResponse>();
    }
}
