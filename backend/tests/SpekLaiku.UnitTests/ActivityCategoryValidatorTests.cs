using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Every category field message in contracts/categories-api.md except the duplicate name, which
/// the service checks (spec FR-003 to FR-010).
/// </summary>
public class ActivityCategoryValidatorTests
{
    private static readonly ActivityCategoryRequest ValidOutdoor = new(
        Name: "Swimming",
        Type: "Outdoor",
        DefaultDurationHours: 2m,
        RequiresDaylight: true,
        MaxWindMs: 8m,
        MaxRainMmPerHour: 0.5m,
        MinTemperatureC: 18m,
        MaxTemperatureC: 35m,
        PlaceTags: "leisure=bathing_place, sport=swimming");

    private static readonly ActivityCategoryRequest ValidIndoor = ValidOutdoor with
    {
        Name = "Gallery",
        Type = "Indoor",
        RequiresDaylight = false,
        MaxWindMs = null,
        MaxRainMmPerHour = null,
        MinTemperatureC = null,
        MaxTemperatureC = null,
        PlaceTags = "tourism=gallery"
    };

    [Fact]
    public void ValidOutdoorRequest_ReturnsTrimmedAndNormalizedValues()
    {
        var result = ActivityCategoryValidator.Validate(ValidOutdoor with { Name = "  Open water  " });

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
        Assert.Equal("Open water", result.Category.Name);
        Assert.Equal("OPEN WATER", result.Category.NormalizedName);
        Assert.Equal(ActivityType.Outdoor, result.Category.Type);
        Assert.Equal(2m, result.Category.DefaultDurationHours);
        Assert.True(result.Category.RequiresDaylight);
        Assert.Equal(8m, result.Category.MaxWindMs);
        Assert.Equal(0.5m, result.Category.MaxRainMmPerHour);
        Assert.Equal(18m, result.Category.MinTemperatureC);
        Assert.Equal(35m, result.Category.MaxTemperatureC);
        Assert.Equal(["leisure=bathing_place", "sport=swimming"], result.Category.PlaceTags);
    }

    [Fact]
    public void EmptyRequest_ReturnsRequiredFieldsInFormOrder()
    {
        var result = ActivityCategoryValidator.Validate(
            new ActivityCategoryRequest(null, null, null, false, null, null, null, null, null));

        Assert.False(result.IsValid);
        Assert.Equal(["name", "type", "defaultDurationHours", "placeTags"], result.Errors.Keys);
    }

    [Fact]
    public void OutdoorRequestWithoutLimits_ReturnsEveryFieldInFormOrder()
    {
        var result = ActivityCategoryValidator.Validate(new ActivityCategoryRequest(
            null, "Outdoor", null, false, null, null, null, null, null));

        Assert.Equal(
            ["name", "defaultDurationHours", "maxWindMs", "maxRainMmPerHour", "minTemperatureC", "maxTemperatureC",
                "placeTags"],
            result.Errors.Keys);
        Assert.Equal("Enter a wind limit between 0 and 30 m/s.", result.Errors["maxWindMs"]);
        Assert.Equal("Enter a rain limit between 0 and 20 mm/h.", result.Errors["maxRainMmPerHour"]);
        Assert.Equal("Enter a minimum temperature between -30 and 45 °C.", result.Errors["minTemperatureC"]);
        Assert.Equal("Enter a maximum temperature between -30 and 45 °C.", result.Errors["maxTemperatureC"]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void MissingName_ReturnsEnterName(string? name)
    {
        AssertSingleError(ValidOutdoor with { Name = name }, "name", "Enter a category name.");
    }

    [Theory]
    [InlineData("A")]
    [InlineData("  A  ")]
    public void NameShorterThanTwoCharacters_ReturnsLengthMessage(string name)
    {
        AssertSingleError(ValidOutdoor with { Name = name }, "name", "Category name must be between 2 and 60 characters.");
    }

    [Fact]
    public void NameLongerThanSixtyCharacters_ReturnsLengthMessage()
    {
        AssertSingleError(
            ValidOutdoor with { Name = new string('a', 61) },
            "name",
            "Category name must be between 2 and 60 characters.");
    }

    [Theory]
    [InlineData(2)]
    [InlineData(60)]
    public void NameOfTwoOrSixtyCharactersAfterTrimming_IsAccepted(int length)
    {
        var name = new string('a', length);

        var result = ActivityCategoryValidator.Validate(ValidOutdoor with { Name = $"  {name}  " });

        Assert.True(result.IsValid);
        Assert.Equal(name, result.Category.Name);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("outdoor")]
    [InlineData("INDOOR")]
    [InlineData("Both")]
    public void UnknownType_ReturnsSelectType(string? type)
    {
        AssertSingleError(ValidOutdoor with { Type = type }, "type", "Select a type.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0.4)]
    [InlineData(12.5)]
    [InlineData(1.3)]
    public void InvalidDuration_ReturnsDurationMessage(double? duration)
    {
        AssertSingleError(
            ValidOutdoor with { DefaultDurationHours = (decimal?)duration },
            "defaultDurationHours",
            "Enter a duration between 0.5 and 12 hours.");
    }

    [Fact]
    public void OutdoorLimitOutOfRange_ReturnsThatFieldsMessage()
    {
        AssertSingleError(ValidOutdoor with { MaxWindMs = 30.1m }, "maxWindMs", "Enter a wind limit between 0 and 30 m/s.");
        AssertSingleError(
            ValidOutdoor with { MaxRainMmPerHour = 1.25m },
            "maxRainMmPerHour",
            "Enter a rain limit between 0 and 20 mm/h.");
        AssertSingleError(
            ValidOutdoor with { MinTemperatureC = -30.1m },
            "minTemperatureC",
            "Enter a minimum temperature between -30 and 45 °C.");
        AssertSingleError(
            ValidOutdoor with { MaxTemperatureC = 45.1m },
            "maxTemperatureC",
            "Enter a maximum temperature between -30 and 45 °C.");
    }

    [Theory]
    [InlineData(20, 20)]
    [InlineData(25, 20)]
    public void MinimumNotLowerThanMaximum_ReturnsOrderMessageOnMinimum(int min, int max)
    {
        AssertSingleError(
            ValidOutdoor with { MinTemperatureC = min, MaxTemperatureC = max },
            "minTemperatureC",
            "Minimum temperature must be lower than maximum temperature.");
    }

    [Fact]
    public void MaximumOutOfRange_DoesNotAddOrderMessage()
    {
        // 50 is out of range, so the minimum of 40 is not compared with it.
        AssertSingleError(
            ValidOutdoor with { MinTemperatureC = 40m, MaxTemperatureC = 50m },
            "maxTemperatureC",
            "Enter a maximum temperature between -30 and 45 °C.");
    }

    [Fact]
    public void MinimumOutOfRange_ReturnsRangeMessageNotOrderMessage()
    {
        AssertSingleError(
            ValidOutdoor with { MinTemperatureC = 46m, MaxTemperatureC = 20m },
            "minTemperatureC",
            "Enter a minimum temperature between -30 and 45 °C.");
    }

    [Fact]
    public void IndoorRequestWithOutOfRangeLimits_IsValidAndReturnsNullLimits()
    {
        var result = ActivityCategoryValidator.Validate(ValidIndoor with
        {
            MaxWindMs = 99m,
            MaxRainMmPerHour = -5m,
            MinTemperatureC = 40m,
            MaxTemperatureC = 10m
        });

        Assert.True(result.IsValid);
        Assert.Equal(ActivityType.Indoor, result.Category.Type);
        Assert.Null(result.Category.MaxWindMs);
        Assert.Null(result.Category.MaxRainMmPerHour);
        Assert.Null(result.Category.MinTemperatureC);
        Assert.Null(result.Category.MaxTemperatureC);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("slipway")]
    [InlineData(" , ")]
    public void InvalidPlaceTags_ReturnsFormatMessage(string? tags)
    {
        AssertSingleError(
            ValidIndoor with { PlaceTags = tags },
            "placeTags",
            "Enter tags in the form key=value, for example leisure=slipway.");
    }

    [Fact]
    public void PlaceTagsLongerThan200Characters_ReturnsLengthMessage()
    {
        AssertSingleError(
            ValidIndoor with { PlaceTags = "k=" + new string('v', 199) },
            "placeTags",
            "Map place tags can be at most 200 characters.");
    }

    [Fact]
    public void UpdateRequest_ConvertsToTheSameFieldsWithoutVersion()
    {
        var update = new UpdateActivityCategoryRequest(
            "Swimming", "Outdoor", 2m, true, 8m, 0.5m, 18m, 35m, "leisure=bathing_place, sport=swimming", 42);

        Assert.Equal(ValidOutdoor, update.ToCategoryRequest());
    }

    private static void AssertSingleError(ActivityCategoryRequest request, string field, string message)
    {
        var result = ActivityCategoryValidator.Validate(request);

        Assert.False(result.IsValid);
        var error = Assert.Single(result.Errors);
        Assert.Equal(field, error.Key);
        Assert.Equal(message, error.Value);
    }
}
