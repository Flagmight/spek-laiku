using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The plan name rules (feature 010 spec FR-002, docs/ux-design.md Form 5) and copy names (feature 011).</summary>
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

    // Feature 011 spec FR-005, research section 6: copies are named "Copy of <name>", at most 80 characters.
    [Fact]
    public void CopyName_PutsCopyOfBeforeTheName()
    {
        Assert.Equal("Copy of Weekend", SavedPlanValidator.CopyName("Weekend"));
    }

    [Fact]
    public void CopyName_KeepsANameThatEndsExactlyAt80Characters()
    {
        var original = new string('a', 72);

        var copy = SavedPlanValidator.CopyName(original);

        Assert.Equal(80, copy.Length);
        Assert.Equal("Copy of " + original, copy);
    }

    [Fact]
    public void CopyName_CutsTheEndOfALongName()
    {
        var original = new string('a', 72) + new string('b', 8);

        var copy = SavedPlanValidator.CopyName(original);

        Assert.Equal(80, copy.Length);
        Assert.Equal("Copy of " + new string('a', 72), copy);
    }

    [Fact]
    public void CopyName_DoesNotSplitACharacterMadeOfTwoUnits()
    {
        // The emoji is the name's 72nd and 73rd UTF-16 units, so a cut at 80 would keep only its first half.
        var original = new string('a', 71) + "🚲" + "bbb";

        var copy = SavedPlanValidator.CopyName(original);

        Assert.Equal(79, copy.Length);
        Assert.Equal("Copy of " + new string('a', 71), copy);
        Assert.DoesNotContain(copy, char.IsSurrogate);
    }

    [Fact]
    public void CopyName_RemovesASpaceLeftAtTheEndByTheCut()
    {
        // The name's 72nd character is a space, so a cut at 80 would end the copy's name with it.
        var original = new string('a', 71) + " bbb";

        var copy = SavedPlanValidator.CopyName(original);

        Assert.Equal("Copy of " + new string('a', 71), copy);
        Assert.Equal(copy.Trim(), copy);
    }

    [Fact]
    public void CopyName_OfACopy_AddsCopyOfAgain()
    {
        Assert.Equal("Copy of Copy of A", SavedPlanValidator.CopyName(SavedPlanValidator.CopyName("A")));
    }
}
