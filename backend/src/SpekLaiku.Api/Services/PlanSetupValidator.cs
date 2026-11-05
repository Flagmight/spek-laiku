using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The plan setup rules that need no external call (spec FR-010, FR-011, FR-016; data-model.md). Whether
/// the place exists is checked by <c>PlanSetupService</c>. Messages have no "Error: " prefix; the page adds it.
/// Feature 009 reads the distance limits from here.
/// </summary>
public static class PlanSetupValidator
{
    public const int MaxDates = 7;
    public const int MinTravelDistanceKm = 1;
    public const int MaxTravelDistanceKm = 200;
    public const int DefaultTravelDistanceKm = 30;

    public const string LocationMessage = "Select a location in Lithuania from the list.";
    public const string NoDatesMessage = "Add at least one date.";
    public const string TooManyDatesMessage = "You can add up to 7 dates.";
    public const string RepeatedDateMessage = "This date is already added.";
    public const string PastDateMessage = "Dates cannot be in the past.";
    public const string LateDateMessage = "Forecast is not available that far ahead.";
    public const string DistanceMessage = "Enter a whole number between 1 and 200.";

    public static PlanSetupValidationResult Validate(PlanSetupCheckRequest request, DateOnly firstDate, DateOnly lastDate)
    {
        var errors = new List<KeyValuePair<string, string>>();
        if (request.LocationId is not > 0)
        {
            errors.Add(new("locationId", LocationMessage));
        }

        var dates = request.Dates ?? [];
        AddDateErrors(dates, firstDate, lastDate, errors);
        var distance = request.MaxTravelDistanceKm ?? DefaultTravelDistanceKm;
        if (distance != decimal.Truncate(distance) || distance is < MinTravelDistanceKm or > MaxTravelDistanceKm)
        {
            errors.Add(new("maxTravelDistanceKm", DistanceMessage));
        }

        return errors.Count > 0
            ? new PlanSetupValidationResult(errors, [], DefaultTravelDistanceKm)
            : new PlanSetupValidationResult(errors, dates.Distinct().Order().ToList(), (int)distance);
    }

    private static void AddDateErrors(
        List<DateOnly> dates,
        DateOnly firstDate,
        DateOnly lastDate,
        List<KeyValuePair<string, string>> errors)
    {
        if (dates.Count == 0)
        {
            errors.Add(new("dates", NoDatesMessage));
            return;
        }

        // Past the limit only the count is reported, so a long list does not give a message per entry.
        if (dates.Count > MaxDates)
        {
            errors.Add(new("dates", TooManyDatesMessage));
            return;
        }

        for (var index = 0; index < dates.Count; index++)
        {
            var message = DateMessage(dates, index, firstDate, lastDate);
            if (message is not null)
            {
                errors.Add(new($"dates[{index}]", message));
            }
        }
    }

    private static string? DateMessage(List<DateOnly> dates, int index, DateOnly firstDate, DateOnly lastDate)
    {
        var date = dates[index];
        if (dates.IndexOf(date) < index)
        {
            return RepeatedDateMessage;
        }

        if (date < firstDate)
        {
            return PastDateMessage;
        }

        return date > lastDate ? LateDateMessage : null;
    }
}
