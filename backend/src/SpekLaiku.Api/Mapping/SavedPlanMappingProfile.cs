using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Mapping;

/// <summary>
/// Saved plans to the response objects in feature 010 contracts/plans-api.md. The responses are positional
/// records, filled through their constructors, so a parameter without a source member of the same name is set
/// with <c>ForCtorParam</c>. These are path selections only, with no rules. The owner, the generated schedule id
/// and the stored snapshot have no destination member, so they are never sent.
/// </summary>
public sealed class SavedPlanMappingProfile : Profile
{
    public SavedPlanMappingProfile()
    {
        CreateMap<SavedPlan, SavedPlanSummaryResponse>()
            .ForCtorParam(
                nameof(SavedPlanSummaryResponse.SavedAt),
                options => options.MapFrom(plan => AsUtc(plan.SavedAtUtc)));
        CreateMap<SavedPlanSummary, SavedPlanSummaryResponse>()
            .ForCtorParam(
                nameof(SavedPlanSummaryResponse.SavedAt),
                options => options.MapFrom(plan => AsUtc(plan.SavedAtUtc)));

        CreateMap<PlaceLocation, SavedPlanLocationResponse>();
        // The setup, the activities and the schedule come from the stored snapshot; their items use the maps in
        // PlanActivityMappingProfile and PlanScheduleMappingProfile.
        CreateMap<SavedPlan, SavedPlanResponse>()
            .ForCtorParam(
                nameof(SavedPlanResponse.SavedAt),
                options => options.MapFrom(plan => AsUtc(plan.SavedAtUtc)))
            .ForCtorParam(
                nameof(SavedPlanResponse.Location),
                options => options.MapFrom(plan => plan.Snapshot.Setup.Location))
            .ForCtorParam(
                nameof(SavedPlanResponse.Dates),
                options => options.MapFrom(plan => plan.Snapshot.Setup.Dates))
            .ForCtorParam(
                nameof(SavedPlanResponse.MaxTravelDistanceKm),
                options => options.MapFrom(plan => plan.Snapshot.Setup.MaxTravelDistanceKm))
            .ForCtorParam(
                nameof(SavedPlanResponse.Activities),
                options => options.MapFrom(plan => plan.Snapshot.Activities))
            .ForCtorParam(
                nameof(SavedPlanResponse.Scheduled),
                options => options.MapFrom(plan => plan.Snapshot.Schedule.Scheduled))
            .ForCtorParam(
                nameof(SavedPlanResponse.Unscheduled),
                options => options.MapFrom(plan => plan.Snapshot.Schedule.Unscheduled))
            .ForCtorParam(
                nameof(SavedPlanResponse.Travel),
                options => options.MapFrom(plan => plan.Snapshot.Schedule.Travel));
    }

    // The database returns UTC; the kind is set so the offset is always zero.
    private static DateTimeOffset AsUtc(DateTime utc) => new(DateTime.SpecifyKind(utc, DateTimeKind.Utc));
}
