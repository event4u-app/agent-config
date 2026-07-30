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

const _FILE = fileURLToPath(import.meta.url);
export const REPO = path.resolve(path.dirname(_FILE), '..', '..');
const MANIFEST = path.join(REPO, 'src', 'config', 'ci-local-parity.yml');
const WORKFLOWS = path.join(REPO, '.github', 'workflows');
const HOOK = path.join(REPO, 'src', 'scripts', 'install-hooks.sh');

/** Roots of the local closure. `ci` is the local mirror; the hook is what a push runs. */
const LOCAL_ROOTS = ['ci', 'consistency'] as const;

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

function _read_all(dir: string): string {
    if (!fs.existsSync(dir)) return '';
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .sort()
        .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
        .join('\n');
}

export interface ParityReport {
    ci_gates: string[];
    local_gates: string[];
    undeclared_ci_only: string[];
    undeclared_local_only: string[];
    stale_declarations: string[];
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

    return {
        ci_gates: [...ciGates].sort(),
        local_gates: [...localGates].sort(),
        undeclared_ci_only,
        undeclared_local_only,
        stale_declarations,
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
    if (r.undeclared_local_only.length > 0) {
        failed = true;
        process.stdout.write(
            `❌  ${String(r.undeclared_local_only.length)} gate(s) run locally but in no workflow:\n`,
        );
        for (const g of r.undeclared_local_only) process.stdout.write(`  - ${g}\n`);
        process.stdout.write(
            '\n    Prefer adding it to a workflow — this is the direction that let real defects\n' +
                '    merge (16 stale index rows reached main behind a local-only check-index).\n' +
                '    If remote enforcement is genuinely not wanted, declare it under `local_only:`.\n',
        );
    }
    if (r.stale_declarations.length > 0) {
        failed = true;
        process.stdout.write(
            `❌  ${String(r.stale_declarations.length)} stale declaration(s) — now on BOTH sides, so the exemption is dead:\n`,
        );
        for (const g of r.stale_declarations) process.stdout.write(`  - ${g}\n`);
    }

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
