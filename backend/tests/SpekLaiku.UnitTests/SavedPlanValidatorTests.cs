using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The plan name rules (feature 010 spec FR-002, docs/ux-design.md Form 5).</summary>
public sealed class SavedPlanValidatorTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void MissingName_IsRequired(string? name)
    {
        var (trimmed, error) = SavedPlanValidator.CheckName(name);

        Assert.Null(trimmed);
        Assert.Equal(new KeyValuePair<string, string>("name", "Enter a plan name."), error);
    }

    [Fact]
    public void EightyCharacters_Pass()
    {
        var name = new string('a', 80);

        var (trimmed, error) = SavedPlanValidator.CheckName(name);

        Assert.Equal(name, trimmed);
        Assert.Null(error);
    }

    [Fact]
    public void EightyOneCharacters_AreTooLong()
    {
        var (trimmed, error) = SavedPlanValidator.CheckName(new string('a', 81));

        Assert.Null(trimmed);
        Assert.Equal(new KeyValuePair<string, string>("name", "Plan name can be at most 80 characters."), error);
    }

    [Fact]
    public void SurroundingSpaces_AreTrimmed()
    {
        var (trimmed, error) = SavedPlanValidator.CheckName("  Weekend  ");

        Assert.Equal("Weekend", trimmed);
        Assert.Null(error);
    }

    [Fact]
    public void Length_IsCheckedAfterTrimming()
    {
        var name = new string('a', 80);

        var (trimmed, error) = SavedPlanValidator.CheckName($"  {name}  ");

        Assert.Equal(name, trimmed);
        Assert.Null(error);
    }

    [Fact]
    public void MarkupCharacters_AreKeptAsText()
    {
        var (trimmed, error) = SavedPlanValidator.CheckName("<script>");

        Assert.Equal("<script>", trimmed);
        Assert.Null(error);
    }
}
