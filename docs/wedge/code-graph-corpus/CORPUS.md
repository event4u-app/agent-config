# Code-graph benchmark corpus — candidates and floor clearance

> Registry of external-repo candidates for consumer-scale code-graph
> measurements (S0b of `road-to-reachable-code-memory`, and the parked
> benchmark arms in `later/road-to-native-code-intelligence.md`).
> Floor (NOT lowered to fit candidates): one PHP repo ≥ 50k LOC and one
> TS repo ≥ 30k LOC.

| Candidate | Stack | LOC (app code) | SHA at measurement | License / access | Floor clearance |
|---|---|---|---:|---|---|
| `galawork-api` (maintainer-internal Laravel API) | PHP | 399,713 | `834b189d3` | proprietary, maintainer-local | PHP floor ≥50k: **CLEARS (8×)** |
| `galawork-app-react-native` (maintainer-internal RN app) | TS/JS | 74,596 | `3826d57` | proprietary, maintainer-local | TS floor ≥30k: **CLEARS (2.5×)** |
| `galawork-web` (maintainer-internal) | PHP + TS | 477,961 PHP / 21,814 TS | `845b5ff64` | proprietary, maintainer-local | PHP clears; TS below floor |
| `galawork-web2` (maintainer-internal) | PHP + TS | 425,018 PHP / 18,721 TS | `2cf17d6b0` | proprietary, maintainer-local | PHP clears; TS below floor |

LOC counted with `find … -name '*.php' | xargs wc -l` (resp. `*.ts`/`*.tsx`,
excluding `*.d.ts`), `vendor/` and `node_modules/` excluded.

Caveat for published numbers: these candidates are maintainer-local and not
redistributable; any externally-cited benchmark number must either use a
public-repo candidate (none registered yet) or state the corpus is private.

## S0b measurement (2026-07-27)

Ceiling (embedded-engine doctrine): cold build ≤ 60 s AND cache ≤ 80 MB, both arms.

| Arm | Cold build (wall) | Graph cache | Extracts sidecar | Files / nodes / edges |
|---|---:|---:|---:|---|
| PHP — `galawork-api` @ `834b189d3` | **3.7 s** | **36.1 MB** | 34.0 MB | 3,760 / 20,441 / 89,539 |
| TS — `galawork-app-react-native` @ `3826d57` | **1.7 s** | **3.2 MB** | 3.7 MB | 492 / 1,225 / 14,841 |

**Verdict: both arms clear the ceiling with wide margin (worst case 3.7 s of
60 s; 70.1 MB of 80 MB counting cache + sidecar together, 36.1 MB counting
the graph cache alone). S0b PASS — Phase 2 proceeds un-downgraded.**
