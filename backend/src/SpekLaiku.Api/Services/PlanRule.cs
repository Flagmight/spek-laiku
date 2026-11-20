namespace SpekLaiku.Api.Services;

/// <summary>
/// One rule a scheduled activity can break (feature 012 spec FR-005). The order is the order problems are listed
/// within one activity (data-model.md PlanProblem).
/// </summary>
public enum PlanRule
{
    Wind,
    Rain,
    Cold,
    Heat,
    NoForecast,
    BeforeSunrise,
    AfterSunset,
    Overlap,
    Travel
}
