# Data Model: Map Data Service Reliability

**Feature**: `017-overpass-reliability` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

**No database change and no migration.** Everything in this feature lives in configuration, in memory for one request, or in the log.

## MapDataOptions (configuration, `Services/MapDataOptions.cs`)

Bound to the `MapData` section and checked at start-up (spec FR-001 to FR-006; research sections 2 and 3).

| Property | Type | Default | Rule |
|---|---|---|---|
| `MainServer` | `string` | `https://overpass-api.de/` | Absolute `http` or `https` address. `http` only in the Development environment. |
| `MainTimeoutSeconds` | `int` | `6` | 1 to 8. |
| `FallbackServer` | `string?` | empty (none) | Empty, or an address with the same rules as `MainServer`, and not equal to it (trailing slash added, letter case ignored). |
| `FallbackTimeoutSeconds` | `int` | `6` | 1 to 8. Checked even when no fallback is set, so a wrong value is never hidden. |

- A trailing `/` is added to each address when the servers are built (research section 2).
- Validation is done by `MapDataOptionsValidator` (`IValidateOptions<MapDataOptions>`, with `IHostEnvironment`). It returns one message per wrong setting, naming the setting and never its value.

## MapDataServer (`Clients/MapDataServer.cs`)

One configured server, as passed to the client (spec Key Entity "Map Data Server").

| Member | Type | Notes |
|---|---|---|
| `Address` | `Uri` | Absolute, ends with `/`. The client sends to `new Uri(Address, "api/interpreter")`. |
| `Role` | `MapDataServerRole` | `Main` or `Fallback`. Only the role is ever logged, as `main` or `fallback`. |
| `Timeout` | `TimeSpan` | The server's configured waiting time. |

`MapPlacesSearchService` builds the list once from the options: `[Main]` or `[Main, Fallback]`.

## MapDataServerRole (`Clients/MapDataServerRole.cs`)

An enum with two values, `Main` and `Fallback`.

## RequestDeadline (`Services/RequestDeadline.cs`)

The 9-second limit of one place or schedule request (spec FR-007, Key Entity "Request Deadline"; research section 4).

| Member | Notes |
|---|---|
| `Limit` | Constant 9 seconds. |
| `ShortestAttempt` | Constant 1 second. A server is not contacted with less time than this. |
| `Start(ForecastPeriod clock)` | Notes `clock.GetNow()`. Called on the first line of `PlanPlacesService.GetAsync` and `PlanScheduleService.GetAsync`. |
| `Remaining` | `start + Limit - clock.GetNow()`, never below zero. |

**Lifetime**: one per request, passed as an argument through `NearbyPlacesService.GetAsync` to `MapPlacesSearchService.FindAsync`. It is never stored or shared between requests.

## Attempt rules (`MapPlacesSearchService`)

How one request moves through the servers (spec FR-007, FR-009 to FR-014; research sections 5 to 7):

```text
for each server in [Main, Fallback?]:
    time = min(server.Timeout, deadline.Remaining)
    if time < ShortestAttempt:
        log "not contacted: no time left for the <role> server"; stop trying
    try:
        return client.FindAsync(server, time, …)   # success, even with no elements
    catch ExternalServiceException(MapData) as failure:
        last = failure                               # the client already logged it with the role
        continue
throw last, or ExternalServiceException(MapData, Timeout) when no server was contacted
```

Other exceptions, including a cancelled request, are not caught.

## Changed signatures

| Member | Before | After |
|---|---|---|
| `IMapPlacesClient.FindAsync` | `(latitude, longitude, radiusKm, tags, ct)` | `(MapDataServer server, TimeSpan timeout, latitude, longitude, radiusKm, tags, ct)` |
| `NearbyPlacesService.GetAsync` | `(location, radiusKm, categories, ct)` | `(location, radiusKm, categories, RequestDeadline deadline, ct)`. It calls `MapPlacesSearchService` instead of `IMapPlacesClient`. |
| `OverpassQuery.Build` | `(latitude, longitude, radiusKm, tags)` with the constant `[timeout:4]` | `(latitude, longitude, radiusKm, tags, int timeoutSeconds)`. The constant `TimeoutSeconds` is removed. |
| `OverpassMapPlacesClient` | `BaseAddress`, `Timeout` (4 s) | No base address. A 10 s backstop `Timeout`. The default address moves to `MapDataOptions`. |
| `ExternalServiceJson.PostFormAsync`, `Failure` | — | Optional `string? server`, which adds "on the {Server} server" to the warning. |

## Map Data Failure Record (log, extends feature 007)

One warning per failed attempt, written by `ExternalServiceJson.Failure` through `ILogger<OverpassMapPlacesClient>` (spec FR-013; research section 8):

| Field | Example | Notes |
|---|---|---|
| Time | from the logger | |
| `Service` | `Map data service` | Unchanged. |
| `FailureKind` | `Timeout`, `Network`, `UnexpectedStatus`, `InvalidResponse` | Unchanged. |
| `StatusCode` | `502` or empty | Unchanged. |
| `Server` | `main` or `fallback` | **New.** Never the address. |

The user's identity, the position, the radius and the tags are never logged. When a server is skipped because no time is left, `MapPlacesSearchService` writes a separate warning: "Map data service not contacted: no time left for the {Server} server".

## Local Map Data Copy (Docker objects, not application data)

Created and removed only by `scripts/local-map-data.ps1` (spec FR-015, FR-016; research sections 10 and 11).

| Object | Name | Notes |
|---|---|---|
| Container | `speklaiku-overpass` | Image `wiktorn/overpass-api@sha256:<pinned>`. Port 80 published on `127.0.0.1:12345`. Memory limit 2 GB after loading. |
| Volume | `speklaiku-overpass-db` | The loaded database at `/db`. Removed by `remove` and `refresh`. |
| Network | `speklaiku-dev` | Lets the Windows 10 API container reach `http://speklaiku-overpass/`. |

**State transitions** (as reported by `status`):

```text
missing --start--> loading --(load finished, limit set)--> ready
ready --stop--> stopped --start--> ready
any --remove--> missing
any --refresh--> missing --> loading --> ready
loading --(load failed)--> failed (start prints the container's last log lines; remove and start again)
```
