# Contract: Local Map Data Script

**Feature**: `017-overpass-reliability` | Spec User Story 4, FR-015 to FR-017 | Research sections 10 and 11

`scripts/local-map-data.ps1` runs a local copy of the OpenStreetMap Overpass API with the map data for Lithuania only. It is for development and outages. The automated tests, CI and the deployed application never use it.

## Usage

Run from the repository root, in Windows PowerShell 5.1 or PowerShell 7, with Docker running:

```powershell
.\scripts\local-map-data.ps1 <command>
```

| Command | What it does | Ends with |
|---|---|---|
| `start` | **First time**: pulls the pinned image, creates the network `speklaiku-dev` and the volume `speklaiku-overpass-db`, then runs the container `speklaiku-overpass` attached, so the download and loading progress is shown. When loading has finished, it sets the 2 GB memory limit and starts the container to serve. **Later**: starts the existing container. | "Local map data copy is ready at http://127.0.0.1:12345/" after a successful readiness check; otherwise the reason and the container's last log lines. Exit code 0 or 1. |
| `status` | Reports `missing`, `loading`, `stopped`, `failed` or `ready`. When it is ready, it also shows the date of the map data and the memory limit. | Exit code 0 when ready, 1 otherwise. |
| `stop` | Stops the container. The loaded data is kept. | Exit code 0. |
| `remove` | Removes the container, the volume and the network. The next `start` downloads and loads again. | Exit code 0, also when nothing existed. |
| `refresh` | `remove`, then `start`, to load the latest Lithuania data. | As `start`. |

An unknown or missing command prints this table and exits with code 1. The script never touches the application's database, settings or any other container.

## Fixed values

| Value | Setting |
|---|---|
| Image | `wiktorn/overpass-api@sha256:<digest pinned when the script is written>` |
| Map data | `https://download.geofabrik.de/europe/lithuania-latest.osm.pbf` |
| Address for `dotnet run` | `http://127.0.0.1:12345/` (published on `127.0.0.1` only) |
| Address from the API container | `http://speklaiku-overpass/` on the network `speklaiku-dev` |
| Memory while serving | at most 2 GB (`--memory 2g --memory-swap 2g`) |
| Container settings | as in research section 10 |

## Readiness check

`status` and the end of `start` send this query to `http://127.0.0.1:12345/api/interpreter`:

```text
[out:json][timeout:5];node(54.89,23.88,54.91,23.92)["name"];out 1;
```

The copy is `ready` when the answer is valid JSON with at least one element. The data date shown is the answer's `osm3s.timestamp_osm_base`.

## Pointing the API at it

The script does not change any API setting. The developer sets `MapData__MainServer` or `MapData__FallbackServer` (see [map-data-configuration.md](map-data-configuration.md)) in the terminal or container that runs the API. Plain `http` is accepted only when the API runs in the Development environment.
