using System.Text.Json;
using AutoMapper;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Mapping;

/// <summary>
/// The plan check to the response objects in feature 012 contracts/plan-check-api.md. Path selections and formats
/// only, no rules. The "HH:mm" time format is the one in <see cref="PlanForecastMappingProfile"/> and the weather
/// map the one in <see cref="PlanScheduleMappingProfile"/>; a second one would fail the configuration check.
/// </summary>
public sealed class PlanCheckMappingProfile : Profile
{
    public const string CheckedStatus = "checked";
    public const string AllPastStatus = "allPast";

    public PlanCheckMappingProfile()
    {
        CreateMap<PlanRule, string>().ConvertUsing(rule => JsonNamingPolicy.CamelCase.ConvertName(rule.ToString()));
        CreateMap<PlanProblem, PlanProblemResponse>();
        CreateMap<PlanCheckEntry, PlanCheckEntryResponse>();
        CreateMap<PlanCheck, PlanCheckResponse>()
            .ForCtorParam(
                nameof(PlanCheckResponse.SavedAt),
                options => options.MapFrom(check => new DateTimeOffset(DateTime.SpecifyKind(check.SavedAt, DateTimeKind.Utc))))
            .ForCtorParam(
                nameof(PlanCheckResponse.Status),
                options => options.MapFrom(check => check.AllPast ? AllPastStatus : CheckedStatus));
    }
}
