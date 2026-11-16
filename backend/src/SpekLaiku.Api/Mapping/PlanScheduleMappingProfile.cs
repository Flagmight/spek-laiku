using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Mapping;

/// <summary>
/// The plan schedule to the response objects in contracts/plan-schedule-api.md. The TimeOnly-to-"HH:mm"
/// conversion is in <see cref="PlanForecastMappingProfile"/>; a second one would fail the configuration check.
/// Start and End are renamed to StartTime and EndTime here, but the conversion itself is reused.
/// </summary>
public sealed class PlanScheduleMappingProfile : Profile
{
    public PlanScheduleMappingProfile()
    {
        CreateMap<UnscheduledReason, string>().ConvertUsing(
            reason => reason == UnscheduledReason.NoPlace ? "noPlace" : "noSuitableTime");
        CreateMap<WeatherSnapshot, WeatherSnapshotResponse>();
        CreateMap<ScheduledActivity, ScheduledActivityResponse>();
        CreateMap<UnscheduledActivity, UnscheduledActivityResponse>();
        CreateMap<PlanSchedule, PlanScheduleResponse>();
    }

}
