<!-- evidence-type: analysis -->
# A graph that follows you — the first measurement, 2026-10-24

> `road-to-a-graph-that-follows-you` 6.4. Measured on this worktree's own
> repository (the `lane/inbox-ae-graph` branch at `73fa25dc4e`, 4,867 files and an 83 MB
> graph per `code-graph build`) and on the estate fixture of
> `tests/scripts/code_graph/estate_fixture.ts`, on one macOS developer machine
> (Node v26.7.0, `node:sqlite`). Every number below names the command that produced
> it; the scripts are reproduced at the end with the absolute paths they ran
> with replaced by `$W` (the repository root) and `$OLD` (a worktree of the
> pre-Phase-1 commit `f474169932`). Single machine, few runs: the wall-clock
> rows carry the spread so a reader can see the noise.

## 1. Disk per project, before and after Phase 1

Two budgeted refreshes of a fresh clone, with an empty commit between them so
the second one rebuilds and promotes.

| Project | Code | State dir | Twins promoted | Orphaned temp twins | Command |
|---|---|---|---|---|---|
| this repository | before Phase 1 | 500,748 KiB | 0 | 2 × 163,880,960 B | `disk.sh $OLD/src/scripts/code_graph/cli.ts $W before-phase-1` |
| this repository | after Phase 1 | 259,400 KiB | 1 × 80,621,568 B | 0 | `disk.sh $W/src/scripts/code_graph/cli.ts $W after-phase-1` |
| fixture `core` (120 modules) | before Phase 1 | 3,384 KiB | 0 | 1 × 1,822,720 B | `disk.sh $OLD/src/scripts/code_graph/cli.ts <fixture core> fixture-before-phase-1` |
| fixture `core` (120 modules) | after Phase 1 | 2,396 KiB | 1 × 811,008 B | 0 | `disk.sh $W/src/scripts/code_graph/cli.ts <fixture core> fixture-after-phase-1` |

Reading: before Phase 1 every refresh left its temporary twin behind and the
real twin was never promoted, so the indexed read path was off after each
refresh (D1/D1b); the leaked twin was twice the size of today's because it
still carried `graph_json` (D2). After Phase 1 one twin remains, at half the
size, and nothing leaks. The canonical JSON is the same 83,180,376 B in both.
The `disk.sh` run on this repository was taken twice and gave the same figures.

## 2. Refresh time added by the estate index (target ≤ 3 %)

**In-process cost of the index step** (`indexAfterRefresh`, median of 7):

| Project | Rows rewritten (graph changed) | Nothing changed | Command |
|---|---|---|---|
| this repository | 124 ms | 18 ms | `npx tsx idxcost.mts <clone with a built graph> <scratch home> 7` |
| fixture `core` | 14 ms | 11 ms | `npx tsx idxcost.mts <fixture core> <its home> 7` |

**Wall clock of the whole command, index off versus on** (median of 7, seconds,
`idx.sh <repo> 7 <file to edit>`):

| Project | Scenario | Off | On | Δ | Off runs | On runs |
|---|---|---|---|---|---|---|
| this repository | refresh after an empty commit | 4.58 | 4.42 | −3.5 % | 4.64 4.68 4.54 4.54 4.58 4.64 4.58 | 4.59 4.47 4.45 4.42 4.34 4.33 4.29 |
| this repository | refresh after a source edit | 4.64 | 4.52 | −2.6 % | 4.70 4.58 4.62 4.64 4.65 4.63 4.65 | 4.51 4.57 4.74 4.52 4.53 4.52 4.48 |
| this repository | full build after a source edit | 8.96 | 8.95 | −0.1 % | 8.87 8.97 8.96 9.01 9.15 8.68 8.83 | 8.51 8.97 9.12 8.95 8.78 9.08 8.55 |
| fixture `core` | refresh after an empty commit | 0.38 | 0.42 | +10.5 % | 0.37 0.38 0.38 0.38 0.38 0.37 0.38 | 0.42 0.43 0.40 0.40 0.44 0.49 0.42 |
| fixture `core` | refresh after a source edit | 0.45 | 0.49 | +8.9 % | 0.42 0.43 0.50 0.48 0.45 0.49 0.45 | 0.51 0.49 0.58 0.49 0.44 0.49 0.48 |
| fixture `core` | full build after a source edit | 0.27 | 0.27 | 0.0 % | 0.26 0.26 0.27 0.27 0.24 0.31 0.27 | 0.28 0.27 0.27 0.29 0.25 0.27 0.25 |

Reading, stated narrowly:

- **This repository meets the target.** The step costs 124 ms when it rewrites
  rows, 2.7 % of a 4.64 s refresh, and 18 ms (0.4 %) when nothing changed. The
  wall-clock medians do not resolve a cost that small: the "on" runs came out
  faster, which is machine noise of a few percent, not a saving.
- **The small fixture misses it.** Its refreshes take 0.4 s, and the index adds a
  roughly fixed 40 ms (loading `node:sqlite`, one `git ls-files`, opening two
  databases) — 9–11 %. The target holds for a repository whose refresh is a few
  seconds and is missed for one whose refresh is a few hundred milliseconds; the
  absolute cost there is the 40 ms.
- Two changes made the repository figure: manifests are read from
  `git ls-files` instead of a second tree walk, and an unchanged graph with
  unchanged manifests rewrites nothing. A first run before them measured the
  step at about 330 ms (+7.6 % on refresh), recorded here so the gain is not
  implied.

## 3. Index size

| Estate | Index | Summed graph JSON | Share | Command |
|---|---|---|---|---|
| this repository alone | 1,019,904 B | 83,180,376 B | 1.23 % | `idx.sh $W 7 src/scripts/code_graph/sanitize.ts` (last line) |
| fixture estate, 3 projects × 120 modules | 40,960 B | 3,025,926 B | 1.35 % | `npx tsx wu.mts $W <scratch> 120 50` |

Both are under the 2 % of step 4.4, which
`npx vitest run tests/scripts/code_graph/estate_index.test.ts` enforces on the
fixture estate.

## 4. `where-used` latency on the fixture estate (target < 200 ms)

| Measure | Value | Command |
|---|---|---|
| `where-used vitest` answer | `app`, `core` (never `billing`) | `npx tsx wu.mts $W <scratch> 120 50` |
| in-process, open + query + close, median of 50 | 0.15 ms | same |
| in-process, slowest of 50 | 0.31 ms | same |
| CLI wall clock, one run, including `tsx` start | 127 ms | same (`estate where-used vitest` as a child) |

## 5. Zero writes into a foreign repository

| Measure | Value | Command |
|---|---|---|
| `git status --porcelain --untracked-files=all --ignored` lines after `build`, `map --no-verify`, `refresh` | 0 | `zero.sh $W` |
| `agents/` in the foreign repository | absent | same |
| files under the user-global `runtime/graphs/` | 6 | same |

The same property is asserted on every test run by
`tests/scripts/code_graph/foreign_repo.test.ts`, which turns red when
`graphHome` is short-circuited to the in-repository branch.

## Scripts

`disk.sh`

```sh
#!/bin/sh
# usage: disk.sh <cli.ts> <repo-to-clone> <label>
set -e
CLI="$1"; SRC="$2"; LABEL="$3"
H=$(mktemp -d)
git clone -q --no-local "$SRC" "$H/r"
export EVENT4U_CONFIG_HOME="$H/home"
TSX=$W/node_modules/.bin/tsx  # W = the repository root
"$TSX" "$CLI" refresh --root "$H/r" --out "$H/s/code-graph-v1.json" --budget-seconds 600 >/dev/null
git -C "$H/r" -c user.email=t@t -c user.name=t commit -q --allow-empty -m bump
"$TSX" "$CLI" refresh --root "$H/r" --out "$H/s/code-graph-v1.json" --budget-seconds 600 >/dev/null
echo "$LABEL du_kib=$(du -sk "$H/s" | cut -f1) sqlite3=$(ls "$H/s" | grep -c '\.sqlite3$') refresh_tmp=$(ls -a "$H/s" | grep -c 'refresh-tmp') twin_bytes=$(stat -f %z "$H/s/code-graph-v1.sqlite3" 2>/dev/null || echo 0) json_bytes=$(stat -f %z "$H/s/code-graph-v1.json")"
ls -la "$H/s" | awk 'NR>3{print "  ", $5, $9}'
rm -rf "$H"
```

`idx.sh` (the `sleep 1.1` before each commit was added for the fixture rows: a
refresh judges staleness by comparing the cache's mtime with the last commit's
second, and a sub-second fixture build would otherwise read as fresh; the
repository rows ran before it, where every build takes seconds)

```sh
#!/bin/sh
# usage: idx.sh <repo-to-clone> <runs> <edit-file-relative-path>
set -e
W=${W:?set W to the repository root}
TSX=$W/node_modules/.bin/tsx; CLI=$W/src/scripts/code_graph/cli.ts
H=$(mktemp -d); git clone -q --no-local "$1" "$H/r"; export EVENT4U_CONFIG_HOME="$H/home"
"$TSX" "$CLI" build --root "$H/r" >/dev/null
t() { /usr/bin/time -p "$@" 2>&1 >/dev/null | awk '/^real/{print $2}'; }
for mode in off on; do
  "$TSX" "$CLI" projects index $mode >/dev/null
  for i in $(seq 1 "$2"); do
    sleep 1.1; git -C "$H/r" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "bump $mode $i"
    echo "refresh-unchanged index=$mode run=$i real_s=$(t "$TSX" "$CLI" refresh --root "$H/r" --budget-seconds 600)"
  done
  for i in $(seq 1 "$2"); do
    echo "// edit $mode $i" >> "$H/r/$3"
    sleep 1.1; git -C "$H/r" -c user.email=t@t -c user.name=t commit -q -am "edit $mode $i"
    echo "refresh-edited index=$mode run=$i real_s=$(t "$TSX" "$CLI" refresh --root "$H/r" --budget-seconds 600)"
  done
  for i in $(seq 1 "$2"); do
    sleep 1.1; echo "// build $mode $i" >> "$H/r/$3"
    echo "build-edited index=$mode run=$i real_s=$(t "$TSX" "$CLI" build --root "$H/r")"
  done
done
echo "index_bytes=$(stat -f %z "$H/home/runtime/projects/index.sqlite3") graph_json_bytes=$("$TSX" -e "process.stdout.write(String(require(\"fs\").statSync(process.argv[1]).size))" "$("$TSX" "$CLI" detect --root "$H/r" --format json | sed -E "s/.*\"source\":\{[^}]*\"path\":\"([^\"]+)\".*/\1/")")"
rm -rf "$H"
```

`idxcost.mts`

```ts
// usage: tsx idxcost.mts <root with a built graph> <scratch home> <runs>
import fs from 'node:fs';
const [root, home, runsArg] = process.argv.slice(2) as [string, string, string];
process.env.EVENT4U_CONFIG_HOME = home;
const W = `${process.env.W}/src/scripts`; // W = the repository root
const { recordProject, updateRegistry } = await import(`${W}/_lib/project_registry.ts`);
const { indexAfterRefresh, indexPath } = await import(`${W}/code_graph/estate_index.ts`);
const { graphHome } = await import(`${W}/code_graph/graph_home.ts`);
const id = recordProject(root);
updateRegistry((r: { index: boolean }) => { r.index = true; });
const cache = graphHome(root).cachePath;
const med = (a: number[]): number => a.sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
const changed: number[] = [], unchanged: number[] = [];
for (let i = 0; i < Number(runsArg); i++) {
    fs.rmSync(indexPath(), { force: true });
    let t = performance.now(); indexAfterRefresh(id, root, cache, null); changed.push(performance.now() - t);
    t = performance.now(); indexAfterRefresh(id, root, cache, null); unchanged.push(performance.now() - t);
}
console.log(JSON.stringify({ changed_ms: Math.round(med(changed)), unchanged_ms: Math.round(med(unchanged)), runs: Number(runsArg) }));
```

`wu.mts`

```ts
// usage: tsx wu.mts <repo root> <scratch dir> <modules per project> <runs>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [W, base, modules, runs] = process.argv.slice(2) as [string, string, string, string];
fs.rmSync(base, { recursive: true, force: true });
fs.mkdirSync(base, { recursive: true });
process.env.EVENT4U_CONFIG_HOME = path.join(base, 'home');
const { makeEstate } = await import(`${W}/tests/scripts/code_graph/estate_fixture.ts`);
const { main } = await import(`${W}/src/scripts/code_graph/cli.ts`);
const { openEstate, indexPath } = await import(`${W}/src/scripts/code_graph/estate_index.ts`);
const { whereUsed } = await import(`${W}/src/scripts/code_graph/estate_cli.ts`);
const { graphHome } = await import(`${W}/src/scripts/code_graph/graph_home.ts`);
const e = makeEstate(base, Number(modules));
const w = process.stdout.write.bind(process.stdout);
process.stdout.write = (() => true) as never;
await main(['projects', 'index', 'on']);
for (const r of [e.core, e.app, e.billing]) await main(['build', '--root', r]);
process.stdout.write = w;
const ms: number[] = [];
let users: string[] = [];
for (let i = 0; i < Number(runs); i++) {
    const t = performance.now();
    const db = openEstate()!;
    try {
        users = whereUsed(db, 'vitest').package_users.map((p: { name: string }) => p.name);
    } finally {
        db.close();
    }
    ms.push(performance.now() - t);
}
ms.sort((a, b) => a - b);
const graphs = [e.core, e.app, e.billing].reduce((n, r) => n + fs.statSync(graphHome(r).cachePath).size, 0);
console.log(JSON.stringify({ where_used_vitest: users, median_ms: +ms[Math.floor(ms.length / 2)]!.toFixed(2), max_ms: +ms[ms.length - 1]!.toFixed(2), runs: Number(runs), index_bytes: fs.statSync(indexPath()).size, graph_json_bytes: graphs }));
console.log(`core=${e.core}`);
const t0 = performance.now();
execFileSync(`${W}/node_modules/.bin/tsx`, [`${W}/src/scripts/code_graph/cli.ts`, 'estate', 'where-used', 'vitest'], { stdio: 'ignore' });
console.log(JSON.stringify({ cli_wall_ms: Math.round(performance.now() - t0) }));
```

`zero.sh`

```sh
#!/bin/sh
# usage: zero.sh <repo root of agent-config>
set -e
W="$1"; TSX=$W/node_modules/.bin/tsx; CLI=$W/src/scripts/code_graph/cli.ts
H=$(mktemp -d); mkdir -p "$H/foreign/src"; export EVENT4U_CONFIG_HOME="$H/home"
printf 'export function hi(): number {\n    return 1;\n}\n' > "$H/foreign/src/a.ts"
git -C "$H/foreign" init -q; git -C "$H/foreign" add -A; git -C "$H/foreign" -c user.email=t@t -c user.name=t commit -q -m one
"$TSX" "$CLI" build --root "$H/foreign" >/dev/null
"$TSX" "$CLI" map --root "$H/foreign" --no-verify >/dev/null
"$TSX" "$CLI" refresh --root "$H/foreign" >/dev/null
echo "porcelain_lines=$(git -C "$H/foreign" status --porcelain --untracked-files=all --ignored | wc -l | tr -d ' ') agents_dir=$(test -e "$H/foreign/agents" && echo present || echo absent) home_files=$(find "$H/home/runtime/graphs" -type f | wc -l | tr -d ' ')"
rm -rf "$H"
```

The pre-Phase-1 tree: `git worktree add --detach "$OLD" f474169932` with
`node_modules` symlinked from `$W`.
