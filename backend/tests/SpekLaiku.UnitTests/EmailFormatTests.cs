using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The shared email rule used by registration and login (FR-002).</summary>
public class EmailFormatTests
{
    [Theory]
    [InlineData("user@example.com")]
    [InlineData("o'brien@example.com")]
    [InlineData("first.last+tag@sub.example.lt")]
    public void ValidAddress_IsValid(string email)
    {
        Assert.True(EmailFormat.IsValid(email));
    }

    [Theory]
    [InlineData("userexample.com")]
    [InlineData("a@@b.lt")]
    [InlineData("a@b@c.lt")]
    [InlineData("@b.lt")]
    [InlineData("a@b")]
    [InlineData("a@.lt")]
    [InlineData("a@b.")]
    [InlineData("a b@c.lt")]
    public void InvalidAddress_IsNotValid(string email)
    {
        Assert.False(EmailFormat.IsValid(email));
    }

    [Fact]
    public void AddressOfExactly254Characters_IsAccepted()
    {
        var email = new string('a', 242) + "@example.com";
        Assert.Equal(254, email.Length);

        Assert.True(email.Length <= EmailFormat.MaxLength && EmailFormat.IsValid(email));
    }

    [Fact]
    public void AddressOf255Characters_IsRejectedByMaxLength()
    {
        var email = new string('a', 243) + "@example.com";
        Assert.Equal(255, email.Length);

        Assert.False(email.Length <= EmailFormat.MaxLength && EmailFormat.IsValid(email));
    }
}
