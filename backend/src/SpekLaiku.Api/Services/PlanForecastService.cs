using Microsoft.Extensions.Options;
using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The forecast for a plan (spec FR-003 to FR-005, research section 8). The setup and the activities are
/// checked again with <see cref="PlanRecheckService"/> before the weather service is contacted, so the
/// forecast always belongs to a valid plan and to the position the location search service gives for the
/// location's id. The time comes only from <see cref="ForecastPeriod"/> (research section 3).
/// </summary>
public sealed class PlanForecastService(
    PlanRecheckService planRecheckService,
    WeatherForecastService weatherForecastService,
    ForecastPeriod forecastPeriod,
    IOptions<ForecastOptions> options)
{
    public async Task<PlanForecastResult> GetAsync(PlanForecastRequest request, CancellationToken cancellationToken)
    {
        var plan = await planRecheckService.CheckAsync(request.Setup, request.Activities, cancellationToken);
        if (!plan.Succeeded)
        {
            return PlanForecastResult.Invalid(plan.Errors);
        }

        var received = await weatherForecastService.GetAsync(plan.Setup.Location, cancellationToken);

        // Midnight in Lithuania can pass between the setup check and the forecast request, so a date the
        // check accepted may already be outside the period the forecast covers: the setup is then out of date.
        if (plan.Setup.Dates.Any(date => received.Data.Days.All(day => day.Date != date)))
        {
            return PlanForecastResult.Invalid(
                [new($"{PlanRecheckService.SetupKey}.dates", PlanSetupValidator.PastDateMessage)]);
        }

        var days = PlanningDays.Build(received.Data, plan.Setup.Dates, forecastPeriod.GetNow(), options.Value);
        var forecasts = plan.Activities.Select(activity => ActivityForecasts.For(activity, days)).ToList();

        return PlanForecastResult.Success(
            new PlanForecast(ForecastPeriod.ToLithuanianMinute(received.ReceivedAt), days, forecasts));
    }
}
