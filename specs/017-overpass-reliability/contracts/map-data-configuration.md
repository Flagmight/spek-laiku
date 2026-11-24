# Contract: Map Data Configuration

**Feature**: `017-overpass-reliability` | Spec FR-001 to FR-008, FR-013 | Research sections 2 to 8

This feature adds **no HTTP endpoint and changes no request or response**. The browser API (`POST /api/plans/places`, `POST /api/plans/schedule`), its `503` map data error and the browser's 10-second limit stay as in features 007 to 009. The interfaces this feature adds are for the person who runs the API: the configuration below, the start-up messages and the log records.

## Settings

Section `MapData` in `appsettings.json`. Each setting can be overridden with an environment variable, using `__` in place of `:`.

| Setting | Environment variable | Default | Allowed |
|---|---|---|---|
| `MapData:MainServer` | `MapData__MainServer` | `https://overpass-api.de/` | Absolute `https` address, or `http` in Development only |
| `MapData:MainTimeoutSeconds` | `MapData__MainTimeoutSeconds` | `6` | Whole number 1 to 8 |
| `MapData:FallbackServer` | `MapData__FallbackServer` | empty, so no fallback | Empty, or as `MainServer` and different from it |
| `MapData:FallbackTimeoutSeconds` | `MapData__FallbackTimeoutSeconds` | `6` | Whole number 1 to 8 |

- An address is the server's root. The API sends to `<address>api/interpreter`, and a missing trailing `/` is added.
- Addresses are read only from configuration, never from a request (FR-004).
- Local values belong in environment variables or the ignored `appsettings.Development.json`, never in a committed file (FR-005).

**Examples**

```powershell
# API started with dotnet run, local copy as the main server
$env:MapData__MainServer = "http://127.0.0.1:12345/"

# Public server first, local copy as the fallback
$env:MapData__FallbackServer = "http://127.0.0.1:12345/"

# API in the Windows 10 Linux container (README), on the speklaiku-dev network
-e "MapData__MainServer=http://speklaiku-overpass/"
```

## Start-up refusal (FR-003)

The API does not start when a setting is wrong. Start-up fails with an `OptionsValidationException` that lists every wrong setting. The messages are fixed and never contain the configured value:

| Condition | Message |
|---|---|
| Not an absolute http or https address | `MapData:MainServer must be an absolute http or https address.` |
| `http` outside Development | `MapData:MainServer may use http only in the Development environment.` |
| Fallback equals main | `MapData:FallbackServer must not be the same as MapData:MainServer.` |
| Waiting time outside 1 to 8 | `MapData:MainTimeoutSeconds must be 1 to 8.` |

The address messages exist for `FallbackServer` too (when it is not empty), and the range message for `FallbackTimeoutSeconds`.

## Timing (FR-006 to FR-008)

- A place request (step 3) and a schedule request (step 4) end within **9 seconds** of reaching the API.
- Each map data server gets `min(its waiting time, time left before the 9 s)`. It is not contacted when that is under 1 second.
- The main server is tried first. The fallback is tried only after a main server failure, and only within the same request. Each server is tried at most once per request.

## Log records (FR-013)

One warning per failed attempt (category `SpekLaiku.Api.Clients.OverpassMapPlacesClient`):

```text
Map data service failed: <FailureKind> <StatusCode> on the <main|fallback> server
```

One warning when a server is skipped for lack of time (category `SpekLaiku.Api.Services.MapPlacesSearchService`):

```text
Map data service not contacted: no time left for the <main|fallback> server
```

Neither record contains an address, the user's identity, the position, the radius or the tags. The Open-Meteo warnings are unchanged.
