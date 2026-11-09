using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The plan activity rules in data-model.md (Validation rules).</summary>
public sealed class PlanActivityValidatorTests
{
    private const string Duration = "Enter a duration between 0.5 and 12 hours.";
    private const string Wind = "Enter a wind limit between 0 and 30 m/s.";
    private const string Rain = "Enter a rain limit between 0 and 20 mm/h.";
    private const string MinTemperature = "Enter a minimum temperature between -30 and 45 °C.";
    private const string MaxTemperature = "Enter a maximum temperature between -30 and 45 °C.";
    private const string TemperatureOrder = "Minimum temperature must be lower than maximum temperature.";
    private const string Unavailable = "This activity is no longer available. Remove it.";
    private const string CategoryChanged = "This activity's category has changed. Remove it and add it again.";

    private static readonly ActivityCategory Kayaking = Category("Kayaking", ActivityType.Outdoor);
    private static readonly ActivityCategory Museum = Category("Museum", ActivityType.Indoor);

    private static readonly Dictionary<Guid, ActivityCategory> Categories = new()
    {
        [Kayaking.Id] = Kayaking,
        [Museum.Id] = Museum
    };

    private static readonly PlanActivityRequest ValidOutdoor =
        new(Kayaking.Id, "Outdoor", 2.5m, true, 8m, 0.5m, 15m, 35m);

    private static readonly PlanActivityRequest ValidIndoor =
        new(Museum.Id, "Indoor", 2m, false, null, null, null, null);

    [Fact]
    public void MaxActivities_IsTen()
    {
        Assert.Equal(10, PlanActivityValidator.MaxActivities);
    }

    [Fact]
    public void HasValidCount_MissingList_GivesTheAddMessage()
    {
        var valid = PlanActivityValidator.HasValidCount(new PlanActivitiesCheckRequest(null), out var error);

        Assert.False(valid);
        Assert.Equal(Error("activities", "Add at least one activity."), error!.Value);
    }

    [Fact]
    public void HasValidCount_EmptyList_GivesTheAddMessage()
    {
        var valid = PlanActivityValidator.HasValidCount(new PlanActivitiesCheckRequest([]), out var error);

        Assert.False(valid);
        Assert.Equal(Error("activities", "Add at least one activity."), error!.Value);
    }

    [Fact]
    public void HasValidCount_ElevenActivities_GivesTheLimitMessage()
    {
        var valid = PlanActivityValidator.HasValidCount(Request(Copies(11)), out var error);

        Assert.False(valid);
        Assert.Equal(Error("activities", "You can add up to 10 activities."), error!.Value);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(10)]
    public void HasValidCount_OneToTenActivities_IsValid(int count)
    {
        var valid = PlanActivityValidator.HasValidCount(Request(Copies(count)), out var error);

        Assert.True(valid);
        Assert.Null(error);
    }

    [Theory]
    [InlineData("durationHours", 0.5d)]
    [InlineData("durationHours", 12d)]
    [InlineData("maxWindMs", 0d)]
    [InlineData("maxWindMs", 30d)]
    [InlineData("maxRainMmPerHour", 0d)]
    [InlineData("maxRainMmPerHour", 20d)]
    public void BoundaryValues_AreAccepted(string field, double value)
    {
        var result = Validate(With(field, (decimal)value));

        Assert.True(result.Succeeded);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void LowestAndHighestTemperatures_AreAccepted()
    {
        var result = Validate(ValidOutdoor with { MinTemperatureC = -30m, MaxTemperatureC = 45m });

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData("durationHours", null, Duration)]
    [InlineData("durationHours", 0.25d, Duration)]
    [InlineData("durationHours", 0d, Duration)]
    [InlineData("durationHours", 12.5d, Duration)]
    [InlineData("durationHours", 1.75d, Duration)]
    [InlineData("maxWindMs", null, Wind)]
    [InlineData("maxWindMs", -0.1d, Wind)]
    [InlineData("maxWindMs", 30.1d, Wind)]
    [InlineData("maxWindMs", 1.25d, Wind)]
    [InlineData("maxRainMmPerHour", null, Rain)]
    [InlineData("maxRainMmPerHour", -0.1d, Rain)]
    [InlineData("maxRainMmPerHour", 20.1d, Rain)]
    [InlineData("maxRainMmPerHour", 1.25d, Rain)]
    [InlineData("minTemperatureC", null, MinTemperature)]
    [InlineData("minTemperatureC", -30.1d, MinTemperature)]
    [InlineData("minTemperatureC", 45.1d, MinTemperature)]
    [InlineData("minTemperatureC", 1.25d, MinTemperature)]
    [InlineData("maxTemperatureC", null, MaxTemperature)]
    [InlineData("maxTemperatureC", -30.1d, MaxTemperature)]
    [InlineData("maxTemperatureC", 45.1d, MaxTemperature)]
    [InlineData("maxTemperatureC", 20.25d, MaxTemperature)]
    public void InvalidValue_GivesOnlyThatFieldsMessage(string field, double? value, string message)
    {
        var result = Validate(With(field, (decimal?)value));

        Assert.False(result.Succeeded);
        Assert.Equal([Error($"activities[0].{field}", message)], result.Errors);
    }

    [Theory]
    [InlineData(20d, 20d)]
    [InlineData(21d, 20d)]
    public void MinimumNotBelowMaximum_IsReportedOnTheMinimum(double min, double max)
    {
        var result = Validate(ValidOutdoor with { MinTemperatureC = (decimal)min, MaxTemperatureC = (decimal)max });

        Assert.Equal([Error("activities[0].minTemperatureC", TemperatureOrder)], result.Errors);
    }

    [Fact]
    public void UnknownCategory_GivesOnlyTheActivityMessage_WhileAnotherActivityGetsItsFieldMessages()
    {
        var result = Validate(
            ValidOutdoor with { CategoryId = Guid.NewGuid(), DurationHours = null },
            ValidOutdoor with { DurationHours = null });

        Assert.Equal(
            [Error("activities[0]", Unavailable), Error("activities[1].durationHours", Duration)],
            result.Errors);
    }

    [Fact]
    public void MissingCategoryId_GivesTheUnavailableMessage()
    {
        var result = Validate(ValidOutdoor with { CategoryId = null });

        Assert.Equal([Error("activities[0]", Unavailable)], result.Errors);
    }

    [Fact]
    public void NullItemInTheList_GivesTheUnavailableMessage()
    {
        var result = PlanActivityValidator.Validate(Request([ValidOutdoor, null!]), Categories);

        Assert.Equal([Error("activities[1]", Unavailable)], result.Errors);
    }

    [Theory]
    [InlineData("Indoor")]
    [InlineData("outdoor")]
    [InlineData("Sometimes")]
    [InlineData(null)]
    public void TypeThatIsNotTheStoredOne_CountsAsChanged(string? type)
    {
        var result = Validate(
            ValidOutdoor with { Type = type, DurationHours = null },
            ValidOutdoor with { DurationHours = 13m });

        Assert.Equal(
            [Error("activities[0]", CategoryChanged), Error("activities[1].durationHours", Duration)],
            result.Errors);
    }

    [Fact]
    public void SameCategoryTwice_GivesTwoResultsInRequestOrder()
    {
        var result = Validate(
            ValidOutdoor with { DurationHours = 1m, MaxWindMs = 5m },
            ValidIndoor,
            ValidOutdoor with { DurationHours = 3m, MaxWindMs = 6m });

        Assert.True(result.Succeeded);
        Assert.Equal(
            [(Kayaking.Id, 1m, (decimal?)5m), (Museum.Id, 2m, null), (Kayaking.Id, 3m, 6m)],
            result.Activities.Select(activity => (activity.CategoryId, activity.DurationHours, activity.MaxWindMs)));
    }

    [Fact]
    public void IndoorActivity_IgnoresLimitsInTheRequestAndReturnsNull()
    {
        var result = Validate(ValidIndoor with
        {
            MaxWindMs = 999m,
            MaxRainMmPerHour = -1m,
            MinTemperatureC = 50m,
            MaxTemperatureC = -50m
        });

        Assert.True(result.Succeeded);
        var activity = Assert.Single(result.Activities);
        Assert.Null(activity.MaxWindMs);
        Assert.Null(activity.MaxRainMmPerHour);
        Assert.Null(activity.MinTemperatureC);
        Assert.Null(activity.MaxTemperatureC);
    }

    [Fact]
    public void Success_UsesTheStoredNameAndTypeAndThePlansOwnValues()
    {
        var result = Validate(ValidOutdoor);

        Assert.True(result.Succeeded);
        Assert.Equal(
            new CheckedPlanActivity(Kayaking.Id, "Kayaking", ActivityType.Outdoor, 2.5m, true, 8m, 0.5m, 15m, 35m),
            Assert.Single(result.Activities));
    }

    [Fact]
    public void Errors_ComeInTheDocumentedOrder()
    {
        var result = Validate(
            new PlanActivityRequest(Kayaking.Id, "Outdoor", null, true, null, null, null, null),
            ValidOutdoor with { CategoryId = Guid.NewGuid() },
            ValidOutdoor with { MinTemperatureC = 30m, MaxTemperatureC = 20m });

        Assert.Equal(
            [
                "activities[0].durationHours",
                "activities[0].maxWindMs",
                "activities[0].maxRainMmPerHour",
                "activities[0].minTemperatureC",
                "activities[0].maxTemperatureC",
                "activities[1]",
                "activities[2].minTemperatureC"
            ],
            result.Errors.Select(error => error.Key));
    }

    [Fact]
    public void Invalid_ReturnsNoActivities()
    {
        var result = Validate(ValidIndoor, ValidOutdoor with { DurationHours = null });

        Assert.False(result.Succeeded);
        Assert.Empty(result.Activities);
    }

    private static PlanActivitiesResult Validate(params PlanActivityRequest[] activities) =>
        PlanActivityValidator.Validate(Request([.. activities]), Categories);

    private static PlanActivitiesCheckRequest Request(List<PlanActivityRequest> activities) => new(activities);

    private static List<PlanActivityRequest> Copies(int count) => Enumerable.Repeat(ValidOutdoor, count).ToList();

    private static PlanActivityRequest With(string field, decimal? value) => field switch
    {
        "durationHours" => ValidOutdoor with { DurationHours = value },
        "maxWindMs" => ValidOutdoor with { MaxWindMs = value },
        "maxRainMmPerHour" => ValidOutdoor with { MaxRainMmPerHour = value },
        "minTemperatureC" => ValidOutdoor with { MinTemperatureC = value },
        "maxTemperatureC" => ValidOutdoor with { MaxTemperatureC = value },
        _ => throw new ArgumentOutOfRangeException(nameof(field), field, null)
    };

    private static KeyValuePair<string, string> Error(string key, string message) => new(key, message);

    private static ActivityCategory Category(string name, ActivityType type) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        NormalizedName = name.ToUpperInvariant(),
        Type = type,
        DefaultDurationHours = 2m
    };
}
