using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The plan setup rules in data-model.md (spec FR-010, FR-011, FR-016).</summary>
public sealed class PlanSetupValidatorTests
{
    private static readonly DateOnly First = new(2026, 11, 4);
    private static readonly DateOnly Last = new(2026, 11, 10);

    [Fact]
    public void EmptyRequest_ReportsLocationThenDates()
    {
        var result = Validate(new PlanSetupCheckRequest(null, null, null));

        Assert.Equal(
            [
                Error("locationId", "Select a location in Lithuania from the list."),
                Error("dates", "Add at least one date.")
            ],
            result.Errors);
    }

    [Theory]
    [InlineData(0L)]
    [InlineData(-5L)]
    public void NonPositiveLocationId_IsRefused(long locationId)
    {
        var result = Validate(Request(locationId: locationId));

        Assert.Equal([Error("locationId", "Select a location in Lithuania from the list.")], result.Errors);
    }

    [Fact]
    public void EmptyDateList_IsRefused()
    {
        var result = Validate(Request(dates: []));

        Assert.Equal([Error("dates", "Add at least one date.")], result.Errors);
    }

    [Fact]
    public void FirstAndLastDateOfThePeriod_AreAccepted()
    {
        var result = Validate(Request(dates: [Last, First]));

        Assert.True(result.IsValid);
        Assert.Equal([First, Last], result.Dates);
    }

    [Fact]
    public void DayBeforeThePeriod_IsInThePast()
    {
        var result = Validate(Request(dates: [First, First.AddDays(-1)]));

        Assert.Equal([Error("dates[1]", "Dates cannot be in the past.")], result.Errors);
    }

    [Fact]
    public void DayAfterThePeriod_IsTooFarAhead()
    {
        var result = Validate(Request(dates: [Last.AddDays(1)]));

        Assert.Equal([Error("dates[0]", "Forecast is not available that far ahead.")], result.Errors);
    }

    [Fact]
    public void RepeatedDate_IsReportedAtTheLaterIndexOnly()
    {
        var result = Validate(Request(dates: [First, Last, First]));

        Assert.Equal([Error("dates[2]", "This date is already added.")], result.Errors);
    }

    [Fact]
    public void EightDates_GiveOnlyTheCountMessage()
    {
        var dates = Enumerable.Range(0, 7).Select(First.AddDays).Append(First.AddDays(-3)).ToList();

        var result = Validate(Request(dates: dates));

        Assert.Equal([Error("dates", "You can add up to 7 dates.")], result.Errors);
    }

    [Fact]
    public void SevenDates_AreAccepted()
    {
        var result = Validate(Request(dates: Enumerable.Range(0, 7).Select(First.AddDays).Reverse().ToList()));

        Assert.True(result.IsValid);
        Assert.Equal(Enumerable.Range(0, 7).Select(First.AddDays), result.Dates);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(200, 200)]
    [InlineData(45, 45)]
    public void WholeDistanceInRange_IsKept(int distance, int expected)
    {
        var result = Validate(Request(distance: distance));

        Assert.True(result.IsValid);
        Assert.Equal(expected, result.MaxTravelDistanceKm);
    }

    [Fact]
    public void MissingDistance_MeansThirty()
    {
        var result = Validate(Request(distance: null));

        Assert.True(result.IsValid);
        Assert.Equal(30, result.MaxTravelDistanceKm);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("201")]
    [InlineData("12.5")]
    [InlineData("-5")]
    public void OtherDistance_IsRefused(string distance)
    {
        var result = Validate(Request(distance: decimal.Parse(distance, System.Globalization.CultureInfo.InvariantCulture)));

        Assert.Equal([Error("maxTravelDistanceKm", "Enter a whole number between 1 and 200.")], result.Errors);
    }

    [Fact]
    public void EveryFailingField_IsReportedTogetherInContractOrder()
    {
        var result = Validate(new PlanSetupCheckRequest(null, [Last.AddDays(1), First.AddDays(-1)], 0m));

        Assert.Equal(
            ["locationId", "dates[0]", "dates[1]", "maxTravelDistanceKm"],
            result.Errors.Select(error => error.Key));
    }

    private static KeyValuePair<string, string> Error(string key, string message) => new(key, message);

    private static PlanSetupValidationResult Validate(PlanSetupCheckRequest request) =>
        PlanSetupValidator.Validate(request, First, Last);

    private static PlanSetupCheckRequest Request(
        long locationId = 598316,
        List<DateOnly>? dates = null,
        decimal? distance = 30) =>
        new(locationId, dates ?? [First], distance);
}
