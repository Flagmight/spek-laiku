using Microsoft.Extensions.Options;
using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The forecast for a plan (spec FR-003 to FR-005, research section 8). The setup and the activities are
/// checked again with the feature 004 and 005 services before the weather service is contacted, so the
/// forecast always belongs to a valid plan and to the position the location search service gives for the
/// location's id. The time comes only from <see cref="ForecastPeriod"/> (research section 3).
/// </summary>
public sealed class PlanForecastService(
    PlanSetupService planSetupService,
    PlanActivityService planActivityService,
    WeatherForecastService weatherForecastService,
    ForecastPeriod forecastPeriod,
    IOptions<ForecastOptions> options)
{
    public const string SetupKey = "setup";
    public const string MissingSetupMessage = "The request is invalid.";

    public async Task<PlanForecastResult> GetAsync(PlanForecastRequest request, CancellationToken cancellationToken)
    {
        if (request.Setup is null)
        {
            return PlanForecastResult.Invalid([new(SetupKey, MissingSetupMessage)]);
        }

        var setup = await planSetupService.CheckAsync(request.Setup, cancellationToken);
        if (!setup.Succeeded)
        {
            return PlanForecastResult.Invalid(
                setup.Errors.Select(error => new KeyValuePair<string, string>($"{SetupKey}.{error.Key}", error.Value)).ToList());
        }

        var activities = await planActivityService.CheckAsync(
            new PlanActivitiesCheckRequest(request.Activities),
            cancellationToken);
        if (!activities.Succeeded)
        {
            return PlanForecastResult.Invalid(activities.Errors);
        }

        var received = await weatherForecastService.GetAsync(setup.Setup.Location, cancellationToken);
        var days = PlanningDays.Build(received.Data, setup.Setup.Dates, forecastPeriod.GetNow(), options.Value);
        var forecasts = activities.Activities.Select(activity => ActivityForecasts.For(activity, days)).ToList();

        return PlanForecastResult.Success(new PlanForecast(ToMinute(received.ReceivedAt), days, forecasts));
    }

    // ReceivedAt already carries Lithuania's offset (ForecastPeriod.GetNow).
    private static TimeOnly ToMinute(DateTimeOffset receivedAt) => new(receivedAt.Hour, receivedAt.Minute);
}
