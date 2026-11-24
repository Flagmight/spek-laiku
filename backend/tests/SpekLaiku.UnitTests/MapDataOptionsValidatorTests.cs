using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The start-up check of the <c>MapData</c> settings (feature 017 spec FR-003; research section 2): one message per
/// wrong setting, naming the setting and never its value.
/// </summary>
public sealed class MapDataOptionsValidatorTests
{
    private const string LocalCopy = "http://localhost:12345";
    private const string WithCredentials = "https://secret-user:secret-pass@mirror.test/";

    [Fact]
    public void Defaults_AreValidInProduction()
    {
        var result = Validate(new MapDataOptions(), Environments.Production);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData("not an address")]
    [InlineData("/relative/path")]
    [InlineData("ftp://mirror.test/")]
    [InlineData("localhost:12345")]
    [InlineData("")]
    public void MainServerThatIsNotAnHttpOrHttpsAddress_Fails(string address)
    {
        var result = Validate(new MapDataOptions { MainServer = address }, Environments.Production);

        Assert.Equal(["MapData:MainServer must be an absolute http or https address."], result.Failures);
    }

    [Fact]
    public void FallbackServerThatIsNotAnAddress_Fails()
    {
        var result = Validate(new MapDataOptions { FallbackServer = "not an address" }, Environments.Production);

        Assert.Equal(["MapData:FallbackServer must be an absolute http or https address."], result.Failures);
    }

    [Fact]
    public void HttpMainServer_IsValidInDevelopment()
    {
        var result = Validate(new MapDataOptions { MainServer = LocalCopy }, Environments.Development);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void HttpFallbackServer_IsValidInDevelopment()
    {
        var result = Validate(new MapDataOptions { FallbackServer = LocalCopy }, Environments.Development);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    [InlineData("Testing")]
    public void HttpMainServer_FailsOutsideDevelopment(string environment)
    {
        var result = Validate(new MapDataOptions { MainServer = LocalCopy }, environment);

        Assert.Equal(["MapData:MainServer may use http only in the Development environment."], result.Failures);
    }

    [Fact]
    public void HttpFallbackServer_FailsOutsideDevelopment()
    {
        var result = Validate(new MapDataOptions { FallbackServer = LocalCopy }, Environments.Production);

        Assert.Equal(["MapData:FallbackServer may use http only in the Development environment."], result.Failures);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyFallbackServer_MeansNoFallbackAndIsValid(string? fallback)
    {
        var result = Validate(new MapDataOptions { FallbackServer = fallback }, Environments.Production);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData("http://localhost:12345", "http://localhost:12345")]
    [InlineData("http://localhost:12345", "HTTP://LOCALHOST:12345/")]
    [InlineData("https://mirror.test/overpass", "https://Mirror.Test/Overpass/")]
    public void FallbackServerSameAsMainServer_Fails(string main, string fallback)
    {
        var result = Validate(
            new MapDataOptions { MainServer = main, FallbackServer = fallback }, Environments.Development);

        Assert.Equal(["MapData:FallbackServer must not be the same as MapData:MainServer."], result.Failures);
    }

    [Fact]
    public void DifferentFallbackServer_IsValid()
    {
        var result = Validate(
            new MapDataOptions { FallbackServer = "https://mirror.test/overpass/" }, Environments.Production);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(8, true)]
    [InlineData(9, false)]
    [InlineData(-4, false)]
    public void MainTimeoutSeconds_MustBeOneToEight(int seconds, bool valid)
    {
        var result = Validate(new MapDataOptions { MainTimeoutSeconds = seconds }, Environments.Production);

        if (valid)
        {
            Assert.True(result.Succeeded);
        }
        else
        {
            Assert.Equal(["MapData:MainTimeoutSeconds must be 1 to 8."], result.Failures);
        }
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(8, true)]
    [InlineData(9, false)]
    public void FallbackTimeoutSeconds_MustBeOneToEightEvenWithoutAFallback(int seconds, bool valid)
    {
        var result = Validate(new MapDataOptions { FallbackTimeoutSeconds = seconds }, Environments.Production);

        if (valid)
        {
            Assert.True(result.Succeeded);
        }
        else
        {
            Assert.Equal(["MapData:FallbackTimeoutSeconds must be 1 to 8."], result.Failures);
        }
    }

    [Fact]
    public void SeveralWrongSettings_GiveOneMessageEach()
    {
        var options = new MapDataOptions
        {
            MainServer = "not an address",
            MainTimeoutSeconds = 12,
            FallbackServer = LocalCopy,
            FallbackTimeoutSeconds = 0
        };

        var result = Validate(options, Environments.Production);

        Assert.Equal(
            [
                "MapData:MainServer must be an absolute http or https address.",
                "MapData:FallbackServer may use http only in the Development environment.",
                "MapData:MainTimeoutSeconds must be 1 to 8.",
                "MapData:FallbackTimeoutSeconds must be 1 to 8."
            ],
            result.Failures);
    }

    [Fact]
    public void Messages_NeverContainTheConfiguredValue()
    {
        var options = new MapDataOptions
        {
            MainServer = WithCredentials.Replace("https", "http"),
            FallbackServer = "ftp://secret-user:secret-pass@other.test/"
        };

        var result = Validate(options, Environments.Production);

        Assert.Equal(2, result.Failures!.Count());
        Assert.All(result.Failures!, message =>
        {
            Assert.DoesNotContain("secret", message);
            Assert.DoesNotContain(".test", message);
        });
    }

    private static Microsoft.Extensions.Options.ValidateOptionsResult Validate(
        MapDataOptions options,
        string environment) =>
        new MapDataOptionsValidator(new StubEnvironment(environment)).Validate(null, options);

    private sealed class StubEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;

        public string ApplicationName { get; set; } = "SpekLaiku.Api";

        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
