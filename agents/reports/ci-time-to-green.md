## CI time-to-green

Window: 2026-10-14T22:19:24.970Z → 2026-10-21T22:19:24.970Z (7 d) · workflow: all · runs listed: 6835 · runs with jobs read: 6619 · jobs timed: 24989

### Queue and execution per job (OS × event)

| OS | Event | Jobs | Queue p50 | Queue p90 | Exec p50 | Exec p90 |
|---|---|---:|---:|---:|---:|---:|
| macos | pull_request | 5628 | 5m34s | 25m09s | 2m18s | 9m34s |
| macos | push | 2309 | 3m08s | 15m47s | 1m59s | 8m59s |
| macos | schedule | 2 | 0s | 0s | 2m08s | 2m08s |
| ubuntu | dynamic | 2 | 2s | 2s | 49s | 2m28s |
| ubuntu | pull_request | 12117 | 29s | 3m34s | 56s | 6m06s |
| ubuntu | push | 4016 | 3s | 1m23s | 53s | 6m09s |
| ubuntu | schedule | 45 | 2s | 3s | 31s | 2m16s |
| ubuntu | workflow_dispatch | 3 | 3s | 6s | 24s | 25s |
| windows | pull_request | 480 | 24s | 1m13s | 3m19s | 3m44s |
| windows | push | 385 | 3s | 37s | 3m15s | 3m37s |
| windows | schedule | 2 | 1s | 2s | 2m18s | 2m19s |

### Time to green per head SHA (required = Sync + Generate Tools Consistency · Standing payload delta + budget gate)

| Event | SHAs | All-green n | All-green p50 | All-green p90 | Required-green n | Required-green p50 | Required-green p90 |
|---|---:|---:|---:|---:|---:|---:|---:|
| dynamic | 1 | 1 | 2m37s | 2m37s | 0 | — | — |
| pull_request | 476 | 226 | 21m17s | 51m44s | 317 | 11m36s | 13m21s |
| push | 204 | 111 | 14m51s | 28m24s | 0 | — | — |
| schedule | 24 | 14 | 34s | 48m32s | 0 | — | — |
| workflow_dispatch | 3 | 1 | 29s | 29s | 0 | — | — |

### Run 39644704455 — Tests (pull_request)

Span: 40m07s

| Job | OS | Queue | Exec |
|---|---|---:|---:|
| Install Script Tests (macos-latest, shard 4/4) | macos | 32m57s | 1m56s |
| Node Tests (macos-latest, shard 1/4) | macos | 31m31s | 8m35s |
| Node Tests (macos-latest, shard 4/4) | macos | 27m34s | 8m26s |
| Install Script Tests (macos-latest, shard 2/4) | macos | 23m50s | 1m52s |
| Install Script Tests (macos-latest, shard 1/4) | macos | 21m54s | 1m57s |
| SVG Witness Tests (macos-latest) | macos | 21m45s | 3m01s |
| Install Script Tests (macos-latest, shard 3/4) | macos | 21m10s | 59s |
| Golden Tests (macos-latest) | macos | 19m52s | 1m15s |
| Workspace Tests (macos-latest) | macos | 19m45s | 1m44s |
| Install Aux Tests (macos-latest) | macos | 19m25s | 2m16s |
| Collector Lifecycle (macos-latest — the macOS row only) | macos | 9m21s | 5m35s |
| Node Tests (macos-latest, shard 3/4) | macos | 7m15s | 12m27s |
| Node Tests (macos-latest, shard 2/4) | macos | 5m41s | 6m24s |
| Node Tests (ubuntu-latest, shard 4/4) | ubuntu | 5m23s | 6m23s |
| Workspace Tests (ubuntu-latest) | ubuntu | 4m46s | 1m16s |
| Install Script Tests (ubuntu-latest, shard 1/4) | ubuntu | 3m03s | 1m04s |
| Install Script Tests (ubuntu-latest, shard 3/4) | ubuntu | 51s | 1m09s |
| Node Tests (ubuntu-latest, shard 2/4) | ubuntu | 46s | 6m11s |
| Install Script Tests (ubuntu-latest, shard 2/4) | ubuntu | 37s | 1m04s |
| Install Script Tests (ubuntu-latest, shard 4/4) | ubuntu | 31s | 1m22s |
| Golden Tests (ubuntu-latest) | ubuntu | 15s | 1m30s |
| Install Aux Tests (ubuntu-latest) | ubuntu | 2s | 1m29s |
| Static Checks (ESLint · typecheck · prepack) | ubuntu | 2s | 6m07s |
| SVG Witness Tests (ubuntu-latest) | ubuntu | 2s | 2m25s |
| Node Tests (ubuntu-latest, shard 3/4) | ubuntu | 2s | 8m40s |
| Node Tests (ubuntu-latest, shard 1/4) | ubuntu | 2s | 5m19s |
