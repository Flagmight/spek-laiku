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
        CreateMap<TravelLeg, TravelLegResponse>();
        CreateMap<TravelSummary, TravelSummaryResponse>();
        // ScheduledActivity.CategoryId has no destination member, so it is never sent to the browser.
        CreateMap<ScheduledActivity, ScheduledActivityResponse>();
        CreateMap<UnscheduledActivity, UnscheduledActivityResponse>();
        // The id is not part of the schedule; the controller sets it from the result (feature 010). A positional
        // record is filled through its constructor, so ForMember(...).Ignore() would not cover it.
        CreateMap<PlanSchedule, PlanScheduleResponse>()
            .ForCtorParam(
                nameof(PlanScheduleResponse.GeneratedScheduleId),
                options => options.MapFrom(_ => (Guid?)null));
    }

}
