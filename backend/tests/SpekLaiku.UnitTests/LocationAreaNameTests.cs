using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The area shown with each suggestion (research section 3, spec FR-004).</summary>
public sealed class LocationAreaNameTests
{
    [Theory]
    [InlineData("Kaunas", "Kaunas", "Kaunas", "Kaunas County")]
    [InlineData("Kauniai", "Panevėžys", "Biržai District Municipality", "Biržai District Municipality")]
    [InlineData("kaunas", "Kaunas", "Kaunas", "Kaunas County")]
    [InlineData("Alytus", "Alytus", null, "Alytus County")]
    [InlineData("Alytus", "Alytus", "  ", "Alytus County")]
    [InlineData("Nida", null, null, "Lithuania")]
    [InlineData("Nida", "", "", "Lithuania")]
    public void For_PicksMunicipalityThenCountyThenCountry(
        string name,
        string? admin1,
        string? admin2,
        string expected)
    {
        Assert.Equal(expected, LocationAreaName.For(name, admin1, admin2));
    }
}
