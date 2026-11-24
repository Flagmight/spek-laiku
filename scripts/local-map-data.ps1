<#
.SYNOPSIS
    Runs a local copy of the OpenStreetMap Overpass API with the map data for Lithuania only.

.DESCRIPTION
    For development and outages of the public map data server (feature 017, User Story 4). The automated tests, CI
    and the deployed application never use it. Point the API at it with the MapData settings, for example
    $env:MapData__MainServer = "http://127.0.0.1:12345/" (see README "Local map data copy").

    The first start downloads the Lithuania extract and loads it without a memory limit, then serves with a 2 GB
    limit. Later starts only start the existing container.

    Runs in Windows PowerShell 5.1 and PowerShell 7. Needs Docker.

.PARAMETER Command
    start   Load the map data the first time, or start the existing copy, and wait until it answers.
    status  Show whether the copy is missing, loading, stopped, failed or ready (exit code 0 only when ready).
    stop    Stop the copy. The loaded data is kept.
    remove  Remove the copy, its data and its network. The next start downloads and loads again.
    refresh Remove, then start: load the latest Lithuania map data.

.EXAMPLE
    .\scripts\local-map-data.ps1 start
#>
param(
    [Parameter(Position = 0)]
    [string]$Command
)

# Not 'Stop': Windows PowerShell 5.1 turns a program's stderr output into an error record when the output is
# redirected, and the loading log (download progress) is written to stderr. Every docker call checks its exit code
# instead (Invoke-Docker), and the web request uses -ErrorAction Stop.
$ErrorActionPreference = 'Continue'

# Fixed values (specs/017-overpass-reliability/contracts/local-map-data-script.md).
$Image = 'wiktorn/overpass-api@sha256:ab893eeac8fa8525fc2227bd29024c239c31da106281c7a5992429c5f00d49a5'
$MapDataUrl = 'https://download.geofabrik.de/europe/lithuania-latest.osm.pbf'
$ContainerName = 'speklaiku-overpass'
$VolumeName = 'speklaiku-overpass-db'
$NetworkName = 'speklaiku-dev'
$HostPort = 12345
$Address = "http://127.0.0.1:$HostPort/"
$MemoryLimit = '2g'
$ReadyTimeoutSeconds = 120

# Central Kaunas: answers with at least one named node once the Lithuania data is loaded.
$ReadinessQuery = '[out:json][timeout:5];node(54.89,23.88,54.91,23.92)["name"];out 1;'

# Container settings (research section 10). OVERPASS_STOP_AFTER_INIT is deliberately not set: the image stops after
# the first load on its own, and a stored value of true would make every later start stop again.
# OVERPASS_RATE_LIMIT must be set: without it the dispatcher's limit is 0 and refuses every query that comes through
# the web server. OVERPASS_SPACE is 1 GiB because a query without [maxsize] (the application's queries) asks for
# 512 MiB, which the dispatcher refuses when the whole space is 512 MiB. The 2 GB container limit still caps memory.
$ContainerSettings = @(
    'OVERPASS_MODE=init',
    "OVERPASS_PLANET_URL=$MapDataUrl",
    'OVERPASS_PLANET_PREPROCESS=mv /db/planet.osm.bz2 /db/planet.osm.pbf && osmium cat -o /db/planet.osm.bz2 /db/planet.osm.pbf && rm /db/planet.osm.pbf',
    'OVERPASS_META=no',
    'OVERPASS_USE_AREAS=false',
    'OVERPASS_SPACE=1073741824',
    'OVERPASS_FASTCGI_PROCESSES=2',
    'OVERPASS_ALLOW_DUPLICATE_QUERIES=yes',
    'OVERPASS_RATE_LIMIT=16'
)

function Show-Usage {
    Write-Host 'Usage: .\scripts\local-map-data.ps1 <command>'
    Write-Host ''
    Write-Host '  start    Load the Lithuania map data the first time, or start the existing copy.'
    Write-Host '  status   Show whether the copy is missing, loading, stopped, failed or ready.'
    Write-Host '  stop     Stop the copy. The loaded data is kept.'
    Write-Host '  remove   Remove the copy, its data and its network.'
    Write-Host '  refresh  Remove, then start: load the latest Lithuania map data.'
}

# Runs docker and stops the script with a clear message when it fails.
function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($args[0]) failed with exit code $LASTEXITCODE."
    }
}

function Assert-DockerRunning {
    & docker version --format '{{.Server.Version}}' | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Docker is not running. Start Docker Desktop and try again.'
        exit 1
    }
}

# The names are matched exactly, so a missing object gives an empty result instead of an error.
function Test-Container { [bool](& docker container ls --all --quiet --filter "name=^$ContainerName$") }
function Test-Volume { [bool](& docker volume ls --quiet --filter "name=^$VolumeName$") }
function Test-Network { [bool](& docker network ls --quiet --filter "name=^$NetworkName$") }

# missing, loading, stopped, failed or running. A container without a memory limit has not finished loading.
function Get-CopyState {
    if (-not (Test-Container)) {
        return 'missing'
    }

    $parts = (& docker container inspect --format '{{.State.Status}}|{{.State.ExitCode}}|{{.HostConfig.Memory}}' $ContainerName) -split '\|'
    $status = $parts[0]
    $exitCode = [int]$parts[1]
    $memory = [int64]$parts[2]

    if ($status -eq 'running') {
        if ($memory -eq 0) { return 'loading' }
        return 'running'
    }

    if ($memory -eq 0 -and $exitCode -ne 0) {
        return 'failed'
    }

    return 'stopped'
}

# The answer to the readiness query, or $null when the copy does not answer usefully yet.
function Get-Readiness {
    try {
        $answer = Invoke-RestMethod -Uri "${Address}api/interpreter" -Method Post -Body @{ data = $ReadinessQuery } -TimeoutSec 10 -ErrorAction Stop
    }
    catch {
        return $null
    }

    if ($null -eq $answer.elements -or @($answer.elements).Count -eq 0) {
        return $null
    }

    return [pscustomobject]@{
        DataDate = $answer.osm3s.timestamp_osm_base
        Elements = @($answer.elements).Count
    }
}

function Wait-Ready {
    $deadline = (Get-Date).AddSeconds($ReadyTimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $ready = Get-Readiness
        if ($null -ne $ready) {
            Write-Host "Local map data copy is ready at $Address (map data from $($ready.DataDate))."
            return $true
        }

        Start-Sleep -Seconds 5
    }

    Write-Host "The local map data copy did not answer within $ReadyTimeoutSeconds seconds. Its last log lines:"
    # Out-Host keeps the log lines out of the return value; otherwise the caller would see a non-empty result.
    & docker logs --tail 30 $ContainerName | Out-Host
    return $false
}

function Set-MemoryLimitAndStart {
    Invoke-Docker update --memory $MemoryLimit --memory-swap $MemoryLimit $ContainerName | Out-Null
    Invoke-Docker start $ContainerName | Out-Null
}

function Start-FirstLoad {
    Write-Host "Downloading and loading the Lithuania map data. This happens once and takes a while."
    Invoke-Docker pull $Image
    if (-not (Test-Network)) { Invoke-Docker network create $NetworkName | Out-Null }
    if (-not (Test-Volume)) { Invoke-Docker volume create $VolumeName | Out-Null }

    $runArguments = @(
        'run', '--name', $ContainerName,
        '--network', $NetworkName,
        '--publish', "127.0.0.1:${HostPort}:80",
        '--volume', "${VolumeName}:/db"
    )
    foreach ($setting in $ContainerSettings) {
        $runArguments += @('--env', $setting)
    }
    $runArguments += $Image

    # Attached, so the download and loading progress is shown. The container stops when loading has finished.
    & docker @runArguments
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Loading failed (exit code $LASTEXITCODE). Its last log lines:"
        & docker logs --tail 30 $ContainerName
        Write-Host 'Run ".\scripts\local-map-data.ps1 remove", then start again.'
        exit 1
    }

    Write-Host "Loading finished. Starting the copy with a $MemoryLimit memory limit."
    Set-MemoryLimitAndStart
}

function Invoke-Start {
    $state = Get-CopyState
    switch ($state) {
        'missing' { Start-FirstLoad }
        'stopped' {
            $memory = [int64](& docker container inspect --format '{{.HostConfig.Memory}}' $ContainerName)
            if ($memory -eq 0) {
                Set-MemoryLimitAndStart
            }
            else {
                Invoke-Docker start $ContainerName | Out-Null
            }
        }
        'running' { }
        'loading' {
            Write-Host 'The map data is still loading in another terminal. Run status later.'
            exit 1
        }
        'failed' {
            Write-Host 'The last load failed. Run ".\scripts\local-map-data.ps1 remove", then start again.'
            exit 1
        }
    }

    if (-not (Wait-Ready)) {
        exit 1
    }
}

function Invoke-Status {
    $state = Get-CopyState
    if ($state -ne 'running') {
        Write-Host $state
        exit 1
    }

    $ready = Get-Readiness
    if ($null -eq $ready) {
        Write-Host 'running, but not answering yet'
        exit 1
    }

    $memory = [int64](& docker container inspect --format '{{.HostConfig.Memory}}' $ContainerName)
    Write-Host "ready at $Address"
    Write-Host "map data from $($ready.DataDate)"
    Write-Host ("memory limit {0:N1} GB" -f ($memory / 1GB))
}

function Invoke-Stop {
    if (Test-Container) {
        Invoke-Docker stop $ContainerName | Out-Null
    }

    Write-Host 'Local map data copy stopped. Its data is kept.'
}

function Invoke-Remove {
    if (Test-Container) { Invoke-Docker rm --force $ContainerName | Out-Null }
    if (Test-Volume) { Invoke-Docker volume rm $VolumeName | Out-Null }
    if (Test-Network) {
        & docker network rm $NetworkName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "The network $NetworkName is still used by another container (for example the API container); it was kept."
        }
    }

    Write-Host 'Local map data copy removed.'
}

if (@('start', 'status', 'stop', 'remove', 'refresh') -notcontains $Command) {
    Show-Usage
    exit 1
}

Assert-DockerRunning
switch ($Command) {
    'start' { Invoke-Start }
    'status' { Invoke-Status }
    'stop' { Invoke-Stop }
    'remove' { Invoke-Remove }
    'refresh' { Invoke-Remove; Invoke-Start }
}

exit 0
