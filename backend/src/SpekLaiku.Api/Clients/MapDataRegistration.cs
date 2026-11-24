using Microsoft.Extensions.Options;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// Registers the map data settings, their start-up check and the Overpass client (feature 017 research section 9).
/// A wrong <c>MapData</c> setting stops the API before it accepts any request (spec FR-003).
/// </summary>
public static class MapDataRegistration
{
    public static IServiceCollection AddMapData(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<MapDataOptions>()
            .Bind(configuration.GetSection(MapDataOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<MapDataOptions>, MapDataOptionsValidator>();
        services.AddHttpClient<IMapPlacesClient, OverpassMapPlacesClient>(OverpassMapPlacesClient.Configure)
            // The request body holds the plan's position; only the client's own warning is logged.
            .RemoveAllLoggers();
        return services;
    }
}
