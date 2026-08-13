#!/usr/bin/env tsx
/**
 * CI ↔ local parity checker.
 *
 * A gate that exists on one side only drifts silently on the other, and both
 * directions cost real defects (see `src/config/ci-local-parity.yml` for the
 * measured cases). This checker DERIVES both sides rather than trusting a list:
 *
 *   CI side     every gate invocation in `.github/workflows/*.yml`
 *   local side  the transitive closure of `task ci` / `task consistency` plus the
 *               pre-push hook, resolved through `Taskfile.yml` + `taskfiles/*.yml`
 *
 * Anything on one side and not the other must be declared in the manifest with a
 * reason, or this fails. Drift stays allowed — but only on the record.
 *
 * Deriving beats listing because a hand-maintained list is exactly what goes stale:
 * the first version of this analysis was done with a one-level grep and reported 71
 * CI-only gates when the real number was 12. The closure is the whole point.
 *
 * Exit codes: 0 parity declared · 1 undeclared drift · 2 manifest/IO error.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_ci_local_parity
 *   ./scripts-run src/scripts/check_ci_local_parity --format json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { checkRatchet } from './_lib/gate_baseline.js';

const _FILE = fileURLToPath(import.meta.url);
export const REPO = path.resolve(path.dirname(_FILE), '..', '..');
const MANIFEST = path.join(REPO, 'src', 'config', 'ci-local-parity.yml');
const HOOK = path.join(REPO, 'src', 'scripts', 'install-hooks.sh');

/** Roots of the local closure. `ci` is the local mirror; the hook is what a push runs. */
const LOCAL_ROOTS = ['ci', 'consistency'] as const;

/**
 * Round 7 § Phase 3 — the third dimension, and why two were not enough.
 *
 * `task ci` INCLUDES `preflight` (`Taskfile.yml:87`), so the two roots above
 * answer "does the local MIRROR match CI". The pass an agent is actually told to
 * run before pushing is `task preflight`, a deliberate subset of `ci` — its own
 * docstring excludes `check_enforcement_coverage` at a measured 30.7 s because
 * "a pre-push gate that doubles the hook teaches people to skip it".
 *
 * That makes `CI ∩ ci \ preflight` invisible to this gate by construction, and it
 * is exactly where round 7's measured "green locally, red remotely" cycles came
 * from: the Thin-Root char cap, the ratchet living in the Node-Tests shard, and
 * the derived-page freshness check.
 *
 * Reported, not gated. The subset is intentional, so failing on it would demand
 * that `preflight` grow into `ci` — the opposite of what its author decided. What
 * this dimension removes is the IMPLICATION that a green preflight means CI will
 * be green.
 */
const PREFLIGHT_ROOTS = ['preflight'] as const;

export interface Declared {
    id: string;
    class: string;
    reason: string;
}

export interface Manifest {
    pre_push_budget_seconds: number;
    ci_only: Declared[];
    local_only: Declared[];
}

export function load_manifest(file = MANIFEST): Manifest {
    if (!fs.existsSync(file)) {
        throw new Error(`manifest not found: ${path.relative(REPO, file)}`);
    }
    const doc = parseYaml(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    const read = (key: string): Declared[] => {
        const raw = doc[key];
        if (raw === null || raw === undefined) return [];
        if (!Array.isArray(raw)) throw new Error(`${key} must be a list`);
        return raw.map((e, i) => {
            const o = e as Record<string, unknown>;
            const id = String(o['id'] ?? '');
            if (id === '') throw new Error(`${key}[${String(i)}]: missing id`);
            const reason = String(o['reason'] ?? '');
            if (reason.trim() === '') {
                // A declaration without a reason is the escape hatch that eats the
                // gate: it looks reviewed and says nothing.
                throw new Error(`${key} (${id}): reason must be non-empty`);
            }
            return { id, class: String(o['class'] ?? 'unclassified'), reason };
        });
    };
    const budget = Number(doc['pre_push_budget_seconds']);
    if (!Number.isFinite(budget) || budget <= 0) {
        throw new Error('pre_push_budget_seconds must be a positive number');
    }
    return { pre_push_budget_seconds: budget, ci_only: read('ci_only'), local_only: read('local_only') };
}

/** Gate ids invoked anywhere in a blob of shell/YAML text. */
export function extract_gates(text: string): Set<string> {
    const out = new Set<string>();
    // ./scripts-run src/scripts/<name>  |  npx tsx src/scripts/<name>.ts  |  .sh
    //
    // The negative lookahead rejects a DIRECTORY segment: `src/scripts/_lib/x.ts`
    // must not register `_lib` as a gate. Without it the first run reported 23
    // CI-only gates, 10 of which were directory names (_cli, _lib, mcp_server, …) —
    // a checker whose own extraction invents gates is worse than none, because every
    // real finding then sits in a pile of noise. The backslash in the class is not
    // decoration: the pre-push hook greps an escaped path (`pack_dependency_allowlist\.json`),
    // and without it that JSON file registered as a local-only gate.
    for (const m of text.matchAll(/src\/scripts\/([a-z0-9_]+)(?:\.(?:ts|sh))?(?![\w/.\\-])/g)) {
        out.add(m[1] as string);
    }
    return out;
}

/** `task <name>` references in a blob of shell/YAML text. */
export function extract_tasks(text: string): Set<string> {
    const out = new Set<string>();
    for (const m of text.matchAll(/\btask\s+([a-z][a-z0-9:_-]*)/g)) {
        out.add(m[1] as string);
    }
    return out;
}

interface TaskDef {
    cmds: string[];
    deps: string[];
}

/** Every task in Taskfile.yml + taskfiles/*.yml, flattened by name. */
export function load_tasks(repo = REPO): Map<string, TaskDef> {
    const files = [path.join(repo, 'Taskfile.yml')];
    const dir = path.join(repo, 'taskfiles');
    if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir).sort()) {
            if (f.endsWith('.yml') || f.endsWith('.yaml')) files.push(path.join(dir, f));
        }
    }
    const tasks = new Map<string, TaskDef>();
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        let doc: Record<string, unknown>;
        try {
            doc = parseYaml(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        } catch {
            continue; // a malformed taskfile is another gate's verdict, not ours
        }
        const raw = doc['tasks'];
        if (typeof raw !== 'object' || raw === null) continue;
        for (const [name, body] of Object.entries(raw as Record<string, unknown>)) {
            const def: TaskDef = { cmds: [], deps: [] };
            const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
            for (const key of ['cmd', 'cmds', 'deps']) {
                const v = b[key];
                if (typeof v === 'string') def.cmds.push(v);
                else if (Array.isArray(v)) {
                    for (const item of v) {
                        if (typeof item === 'string') {
                            if (key === 'deps') def.deps.push(item);
                            else def.cmds.push(item);
                        } else if (typeof item === 'object' && item !== null) {
                            const o = item as Record<string, unknown>;
                            if (typeof o['task'] === 'string') def.deps.push(o['task']);
                            if (typeof o['cmd'] === 'string') def.cmds.push(o['cmd']);
                            if (typeof o['defer'] === 'object' && o['defer'] !== null) {
                                const d = o['defer'] as Record<string, unknown>;
                                if (typeof d['task'] === 'string') def.deps.push(d['task']);
                            }
                        }
                    }
                }
            }
            // Later files win only if the name is new — mirrors `flatten: true`.
            if (!tasks.has(name)) tasks.set(name, def);
        }
    }
    return tasks;
}

/** Transitive closure of gate ids reachable from a set of task roots. */
export function local_closure(roots: readonly string[], tasks: Map<string, TaskDef>): Set<string> {
    const gates = new Set<string>();
    const seen = new Set<string>();
    const queue = [...roots];
    while (queue.length > 0) {
        const name = queue.shift() as string;
        if (seen.has(name)) continue;
        seen.add(name);
        const def = tasks.get(name);
        if (def === undefined) continue;
        for (const blob of [...def.cmds]) {
            for (const g of extract_gates(blob)) gates.add(g);
            for (const t of extract_tasks(blob)) queue.push(t);
        }
        for (const d of def.deps) queue.push(d);
    }
    return gates;
}

/**
 * Drop YAML comments before anything is extracted from a workflow.
 *
 * WHY, and it is the defect this checker was blind to for its whole life. The CI
 * side is built by regexing workflow TEXT for `task <name>` and expanding each
 * name's closure. Several workflow comments contain the literal string
 * `task ci` — while stating that **no workflow invokes it**:
 *
 *     # invokes `task ci`, so a gate registered only there never runs remotely.
 *     # …NO workflow invokes `task ci`, `ci-strict`, or …
 *
 * Read as an invocation, `ci` expanded to its full closure and put all 247
 * `task ci` gates into the "runs in CI" set. `undeclared_local_only` was
 * therefore **0 by construction** — the one direction this manifest's own header
 * calls the one that let real defects merge could not be reported at all, and the
 * prose documenting the gap was what suppressed it.
 *
 * Measured at the repair: CI-side 273 → 106, `undeclared_local_only` 0 → 167 of
 * 247 local gates. A checker whose extraction invents coverage is worse than
 * none, which this file already says about a different extraction bug ten lines
 * up — the same lesson, learned twice.
 *
 * Deliberately crude: a `#` inside a quoted YAML scalar is treated as a comment
 * start. That direction is safe here — it can only make the checker see LESS
 * wiring, i.e. over-report drift, never invent coverage. A YAML parse would be
 * exact, but every workflow would have to be structurally valid for the checker
 * to run at all, and a parity checker that cannot run on a malformed workflow is
 * a parity checker that goes quiet exactly when someone is editing CI.
 */
export function strip_yaml_comments(text: string): string {
    return text
        .split('\n')
        .map((l) => l.replace(/(^|\s)#.*$/, '$1'))
        .join('\n');
}

function _read_all(dir: string): string {
    if (!fs.existsSync(dir)) return '';
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .sort()
        .map((f) => strip_yaml_comments(fs.readFileSync(path.join(dir, f), 'utf-8')))
        .join('\n');
}

export interface ParityReport {
    ci_gates: string[];
    local_gates: string[];
    undeclared_ci_only: string[];
    undeclared_local_only: string[];
    stale_declarations: string[];
    /** Round 7 § Phase 3 — `task preflight`'s own closure. */
    preflight_gates: string[];
    /**
     * `CI ∩ local \ (preflight ∪ pre-push hook)` — gates a push's remote run
     * enforces, the local mirror covers, and NOTHING a push runs locally reaches.
     * Report-only: the measured size of "green locally, red remotely", not a
     * failure.
     *
     * The hook's own closure is in the subtrahend per R2 finding 4: subtracting
     * preflight alone counted gates the pre-push hook already runs, which cannot
     * fail after a push. That read 221; the honest figure is 209.
     */
    ci_not_in_preflight: string[];
}

export function analyse(repo = REPO, manifest?: Manifest): ParityReport {
    const mf = manifest ?? load_manifest();
    const tasks = load_tasks(repo);

    const ciText = _read_all(path.join(repo, '.github', 'workflows'));
    const ciGates = new Set(extract_gates(ciText));
    // A workflow may reach a gate through a task, so expand those too.
    for (const t of extract_tasks(ciText)) {
        for (const g of local_closure([t], tasks)) ciGates.add(g);
    }

    const localGates = local_closure(LOCAL_ROOTS, tasks);
    if (fs.existsSync(HOOK)) {
        const hook = fs.readFileSync(HOOK, 'utf-8');
        for (const g of extract_gates(hook)) localGates.add(g);
        for (const t of extract_tasks(hook)) {
            for (const g of local_closure([t], tasks)) localGates.add(g);
        }
    }

    const declaredCi = new Set(mf.ci_only.map((d) => d.id));
    const declaredLocal = new Set(mf.local_only.map((d) => d.id));

    const undeclared_ci_only = [...ciGates].filter((g) => !localGates.has(g) && !declaredCi.has(g)).sort();
    const undeclared_local_only = [...localGates].filter((g) => !ciGates.has(g) && !declaredLocal.has(g)).sort();
    // A declaration for a gate that is now on both sides is stale — it grants an
    // exemption nothing needs, and the next reader trusts it.
    const stale_declarations = [
        ...[...declaredCi].filter((g) => localGates.has(g) && ciGates.has(g)),
        ...[...declaredLocal].filter((g) => localGates.has(g) && ciGates.has(g)),
    ].sort();

    // Round 7 § 3.1 — the third dimension. Derived the same way as the other two,
    // so it cannot drift from them by construction.
    //
    // R2 finding 4 (medium): the first version subtracted only the `preflight`
    // closure from `localGates`, and `localGates` includes every gate reachable
    // from `install-hooks.sh` — which the PRE-PUSH hook runs. A gate that runs
    // before the push lands cannot produce a "green locally, red remotely" cycle,
    // so counting it inflated the number and mislabelled it, in a step whose own
    // text calls the number "the deliverable, not an adjective". The subtrahend is
    // therefore everything a push already runs: preflight PLUS the hook's own
    // closure.
    const preflightGates = local_closure(PREFLIGHT_ROOTS, tasks);
    const prePush = new Set(preflightGates);
    if (fs.existsSync(HOOK)) {
        const hook = fs.readFileSync(HOOK, 'utf-8');
        for (const g of extract_gates(hook)) prePush.add(g);
        for (const t of extract_tasks(hook)) {
            for (const g of local_closure([t], tasks)) prePush.add(g);
        }
    }
    const ci_not_in_preflight = [...ciGates]
        .filter((g) => localGates.has(g) && !prePush.has(g))
        .sort();

    return {
        ci_gates: [...ciGates].sort(),
        local_gates: [...localGates].sort(),
        undeclared_ci_only,
        undeclared_local_only,
        stale_declarations,
        preflight_gates: [...preflightGates].sort(),
        ci_not_in_preflight,
    };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const wantJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
    let mf: Manifest;
    try {
        mf = load_manifest();
    } catch (e) {
        process.stderr.write(`❌  ci-local-parity manifest: ${(e as Error).message}\n`);
        return 2;
    }
    const r = analyse(REPO, mf);

    if (wantJson) {
        process.stdout.write(`${JSON.stringify({ generated_by: 'check_ci_local_parity', ...r }, null, 2)}\n`);
    }

    // Emitted on every path, including failure — a gate with findings must still
    // report what it inspected.
    process.stderr.write(`scanned: ${String(r.ci_gates.length + r.local_gates.length)}\n`);

    let failed = false;
    if (r.undeclared_ci_only.length > 0) {
        failed = true;
        process.stdout.write(
            `❌  ${String(r.undeclared_ci_only.length)} gate(s) run in CI but are unreachable locally:\n`,
        );
        for (const g of r.undeclared_ci_only) process.stdout.write(`  - ${g}\n`);
        process.stdout.write(
            "\n    Either wire it into the `task ci` chain, or declare it under `ci_only:` in\n" +
                '    src/config/ci-local-parity.yml with the reason it cannot run locally.\n' +
                '    Undeclared, it means a contributor discovers this failure only after pushing.\n',
        );
    }
    // Ratcheted, not listed one by one.
    //
    // Repairing the comment-blindness above took this count from 0 to 167 in one
    // step — pre-existing debt the checker could not see, not new breakage. A hard
    // fail on 167 findings nobody can clear in the change that reveals them is the
    // gate that lands as N instant blockers, which this repository has recorded as
    // a failure mode and refused before. A shrink-only count keeps the property
    // that matters: the number may not RISE, so a gate added to `task ci` with no
    // workflow reds immediately, which is the regression this direction exists to
    // catch. Listing all 167 every run would bury that signal in its own noise.
    const parity = checkRatchet({
        gate: 'ci-parity:local-only',
        actual: r.undeclared_local_only.length,
        repoRoot: REPO,
    });
    if (!parity.ok) {
        failed = true;
        process.stdout.write(`❌  ${parity.message}\n`);
        for (const g of r.undeclared_local_only) process.stdout.write(`  - ${g}\n`);
        process.stdout.write(
            '\n    Prefer adding it to a workflow — this is the direction that let real defects\n' +
                '    merge (16 stale index rows reached main behind a local-only check-index).\n' +
                '    If remote enforcement is genuinely not wanted, declare it under `local_only:`.\n' +
                '    Raising the baseline is a defect, not a fix.\n',
        );
    } else {
        process.stdout.write(`ℹ️   ${parity.message}\n`);
    }
    if (r.stale_declarations.length > 0) {
        failed = true;
        process.stdout.write(
            `❌  ${String(r.stale_declarations.length)} stale declaration(s) — now on BOTH sides, so the exemption is dead:\n`,
        );
        for (const g of r.stale_declarations) process.stdout.write(`  - ${g}\n`);
    }

    // Round 7 § 3.2 — printed on EVERY path, pass or fail, because the number is
    // the deliverable. A green parity verdict above says the local MIRROR matches
    // CI; it says nothing about the pass a contributor is told to run, and reading
    // the green line as if it did is the implication this block removes.
    process.stdout.write(
        `ℹ️   preflight: ${String(r.preflight_gates.length)} gate(s) of the ${String(r.local_gates.length)} local ones; ` +
            `${String(r.ci_not_in_preflight.length)} CI-enforced gate(s) run NEITHER in \`task preflight\` NOR\n` +
            '    anywhere else the pre-push hook reaches — i.e. the set that can only fail after\n' +
            '    a push. `task ci` INCLUDES preflight, so the parity verdict above cannot see it.\n' +
            '    Report-only: the subset is deliberate (see the preflight docstring). A green\n' +
            '    preflight is therefore not a prediction that CI will be green.\n',
    );
    for (const g of r.ci_not_in_preflight) process.stdout.write(`      · ${g}\n`);

    if (!failed) {
        process.stdout.write(
            `✅  CI ↔ local parity: ${String(r.ci_gates.length)} CI gate(s), ${String(r.local_gates.length)} local, ` +
                `${String(mf.ci_only.length)} declared CI-only, ${String(mf.local_only.length)} declared local-only.\n`,
        );
    }
    return failed ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
