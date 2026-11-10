using System.Globalization;
using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Mapping;

/// <summary>The plan forecast to the response objects in contracts/plan-forecast-api.md. No rules here.</summary>
public sealed class PlanForecastMappingProfile : Profile
{
    public PlanForecastMappingProfile()
    {
        CreateMap<TimeOnly, string>().ConvertUsing(time => time.ToString("HH:mm", CultureInfo.InvariantCulture));
        CreateMap<PlanForecast, PlanForecastResponse>();
        CreateMap<PlanningDay, ForecastDayResponse>();
        CreateMap<PlanningHour, ForecastHourResponse>();
        CreateMap<ActivityForecast, ActivityForecastResponse>();
        CreateMap<ActivityDayForecast, ActivityDayForecastResponse>();
        CreateMap<SuitablePeriod, SuitablePeriodResponse>();
        CreateMap<HourSuitability, HourSuitabilityResponse>();
    }
}
