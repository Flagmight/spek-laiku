using Microsoft.Extensions.Options;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks the <c>MapData</c> settings when the API starts (feature 017 spec FR-003; research section 2). Every wrong
/// setting gets its own message, which names the setting and never its value, so an address with a user name or
/// password in it is never printed. Plain <c>http</c> is allowed only in the Development environment, for a local
/// copy of the map data service.
/// </summary>
public sealed class MapDataOptionsValidator(IHostEnvironment environment) : IValidateOptions<MapDataOptions>
{
    public ValidateOptionsResult Validate(string? name, MapDataOptions options)
    {
        var failures = new List<string>();

        var main = CheckAddress(nameof(MapDataOptions.MainServer), options.MainServer, failures);
        Uri? fallback = null;
        if (!string.IsNullOrWhiteSpace(options.FallbackServer))
        {
            fallback = CheckAddress(nameof(MapDataOptions.FallbackServer), options.FallbackServer, failures);
        }

        if (main is not null
            && fallback is not null
            && string.Equals(main.AbsoluteUri, fallback.AbsoluteUri, StringComparison.OrdinalIgnoreCase))
        {
            failures.Add("MapData:FallbackServer must not be the same as MapData:MainServer.");
        }

        CheckTimeout(nameof(MapDataOptions.MainTimeoutSeconds), options.MainTimeoutSeconds, failures);
        CheckTimeout(nameof(MapDataOptions.FallbackTimeoutSeconds), options.FallbackTimeoutSeconds, failures);

        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    // The address, or null when it is wrong (the reason is added to the failures).
    private Uri? CheckAddress(string setting, string? text, List<string> failures)
    {
        Uri address;
        try
        {
            address = MapDataOptions.ToAddress(text ?? string.Empty);
        }
        catch (UriFormatException)
        {
            failures.Add($"MapData:{setting} must be an absolute http or https address.");
            return null;
        }

        if (address.Scheme != Uri.UriSchemeHttp && address.Scheme != Uri.UriSchemeHttps)
        {
            failures.Add($"MapData:{setting} must be an absolute http or https address.");
            return null;
        }

        if (address.Scheme == Uri.UriSchemeHttp && !environment.IsDevelopment())
        {
            failures.Add($"MapData:{setting} may use http only in the Development environment.");
            return null;
        }

        return address;
    }

    private static void CheckTimeout(string setting, int seconds, List<string> failures)
    {
        if (seconds is < MapDataOptions.ShortestTimeoutSeconds or > MapDataOptions.LongestTimeoutSeconds)
        {
            failures.Add(
                $"MapData:{setting} must be {MapDataOptions.ShortestTimeoutSeconds} to "
                + $"{MapDataOptions.LongestTimeoutSeconds}.");
        }
    }
}
