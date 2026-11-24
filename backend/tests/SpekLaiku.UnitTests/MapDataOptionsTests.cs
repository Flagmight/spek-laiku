using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The configured map data servers (feature 017 data-model.md "MapDataOptions"): main first, the fallback only when
/// one is set, and each address ending with <c>/</c> so its path is kept.
/// </summary>
public sealed class MapDataOptionsTests
{
    [Fact]
    public void Defaults_GiveOnlyThePublicMainServer()
    {
        var server = Assert.Single(new MapDataOptions().Servers());

        Assert.Equal(new Uri("https://overpass-api.de/"), server.Address);
        Assert.Equal(MapDataServerRole.Main, server.Role);
        Assert.Equal(TimeSpan.FromSeconds(6), server.Timeout);
    }

    [Fact]
    public void FallbackWithoutAWaitingTime_GetsTheDefaultSixSeconds()
    {
        var servers = new MapDataOptions { FallbackServer = "https://fallback.test/" }.Servers();

        Assert.Equal(TimeSpan.FromSeconds(6), servers[1].Timeout);
    }

    [Fact]
    public void ConfiguredFallback_ComesAfterTheMainServerWithItsOwnTime()
    {
        var options = new MapDataOptions
        {
            MainServer = "https://main.test/",
            MainTimeoutSeconds = 5,
            FallbackServer = "https://fallback.test/",
            FallbackTimeoutSeconds = 3
        };

        var servers = options.Servers();

        Assert.Collection(
            servers,
            main =>
            {
                Assert.Equal(new Uri("https://main.test/"), main.Address);
                Assert.Equal(MapDataServerRole.Main, main.Role);
                Assert.Equal(TimeSpan.FromSeconds(5), main.Timeout);
            },
            fallback =>
            {
                Assert.Equal(new Uri("https://fallback.test/"), fallback.Address);
                Assert.Equal(MapDataServerRole.Fallback, fallback.Role);
                Assert.Equal(TimeSpan.FromSeconds(3), fallback.Timeout);
            });
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void BlankFallback_MeansNoFallback(string fallback)
    {
        Assert.Single(new MapDataOptions { FallbackServer = fallback }.Servers());
    }

    [Theory]
    [InlineData("http://localhost:12345", "http://localhost:12345/")]
    [InlineData("http://localhost:12345/", "http://localhost:12345/")]
    [InlineData("https://mirror.test/overpass", "https://mirror.test/overpass/")]
    [InlineData(" https://mirror.test/overpass/ ", "https://mirror.test/overpass/")]
    public void Address_EndsWithASlashAndKeepsItsPath(string text, string expected)
    {
        var address = MapDataOptions.ToAddress(text);

        Assert.Equal(new Uri(expected), address);
        Assert.Equal(new Uri(expected + "api/interpreter"), new Uri(address, "api/interpreter"));
    }
}
