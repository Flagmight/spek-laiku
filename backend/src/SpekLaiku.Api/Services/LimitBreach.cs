namespace SpekLaiku.Api.Services;

/// <summary>
/// One weather limit one planning hour breaks: the hour's rounded value and the activity's limit. <see cref="Rule"/>
/// is <see cref="PlanRule.Wind"/>, <see cref="PlanRule.Rain"/>, <see cref="PlanRule.Cold"/> or
/// <see cref="PlanRule.Heat"/> (feature 012 research section 5).
/// </summary>
public sealed record LimitBreach(PlanRule Rule, decimal Value, decimal Limit);
