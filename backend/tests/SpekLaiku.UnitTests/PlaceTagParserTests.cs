using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Parsing the map place tags (spec FR-009, research section 3).</summary>
public class PlaceTagParserTests
{
    private const string FormatMessage = "Enter tags in the form key=value, for example leisure=slipway.";
    private const string LengthMessage = "Map place tags can be at most 200 characters.";

    [Fact]
    public void TwoPairs_ReturnsBothInOrder()
    {
        AssertTags("leisure=slipway, sport=canoe", "leisure=slipway", "sport=canoe");
    }

    [Fact]
    public void SpacesAndEmptyEntries_AreRemoved()
    {
        AssertTags(" leisure = slipway ,, sport=canoe ,", "leisure=slipway", "sport=canoe");
    }

    [Theory]
    [InlineData("historic:civilization=roman")]
    [InlineData("tourism=picnic_site")]
    [InlineData("name:lt=Trakų-pilis")]
    public void RealTag_IsAccepted(string tag)
    {
        AssertTags(tag, tag);
    }

    [Fact]
    public void RepeatedPair_IsStoredOnceInFirstEnteredOrder()
    {
        AssertTags("sport=canoe, leisure=slipway, sport = canoe", "sport=canoe", "leisure=slipway");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" , ")]
    [InlineData("slipway")]
    [InlineData("leisure=")]
    [InlineData("=slipway")]
    [InlineData("historic=*")]
    [InlineData("historic")]
    [InlineData("a=b=c")]
    [InlineData("leisure=boat ramp")]
    [InlineData("leisure=slipway, sport")]
    public void InvalidText_ReturnsFormatMessage(string? text)
    {
        AssertError(text, FormatMessage);
    }

    [Fact]
    public void ExactlyMaxLength_IsAccepted()
    {
        var text = "k=" + new string('v', 198);
        Assert.Equal(200, text.Length);

        AssertTags(text, text);
    }

    [Fact]
    public void LongerThanMaxLength_ReturnsLengthMessage()
    {
        var text = "k=" + new string('v', 199);
        Assert.Equal(201, text.Length);

        AssertError(text, LengthMessage);
    }

    [Fact]
    public void LengthIsCheckedBeforeTrimming()
    {
        var text = "k=v" + new string(' ', 198);
        Assert.Equal(201, text.Length);

        AssertError(text, LengthMessage);
    }

    private static void AssertTags(string text, params string[] expected)
    {
        var result = PlaceTagParser.Parse(text);

        Assert.Null(result.Error);
        Assert.Equal(expected, result.Tags);
    }

    private static void AssertError(string? text, string expected)
    {
        var result = PlaceTagParser.Parse(text);

        Assert.Null(result.Tags);
        Assert.Equal(expected, result.Error);
    }
}
