using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The User accounts search text (feature 014 spec FR-002, research section 5).</summary>
public sealed class AdminAccountSearchTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyText_ListsEveryAccount(string? search)
    {
        Assert.Equal((string.Empty, (string?)null), AdminAccountSearch.Validate(search));
    }

    [Fact]
    public void SpacesAround_AreRemoved()
    {
        Assert.Equal(("ana", (string?)null), AdminAccountSearch.Validate("  ana  "));
    }

    [Fact]
    public void Exactly256Characters_IsAccepted()
    {
        var text = new string('a', 256);

        Assert.Equal((text, (string?)null), AdminAccountSearch.Validate(text));
    }

    [Fact]
    public void TwoHundredFiftySixCharactersWithSpacesAround_IsAccepted()
    {
        var text = new string('a', 256);

        Assert.Equal((text, (string?)null), AdminAccountSearch.Validate($"  {text}  "));
    }

    [Fact]
    public void Text257Characters_IsRefusedWithTheMessage()
    {
        var (_, error) = AdminAccountSearch.Validate(new string('a', 257));

        Assert.Equal("Search text can be at most 256 characters.", error);
    }
}
