<!-- evidence-type: analysis -->

# Ratification review — the hook-bundle budget becomes an allowlist and a backstop, and three per-dispatch fixed costs leave the dispatcher — round 4 (complete package)

You are an independent reviewer for a change in the `event4u/agent-config` repository. Gated files: the ratification gate `check_kernel_edit_ratified.ts`, the workflow that runs it (`consistency.yml`), the dispatcher `hooks/dispatch_hook.ts`, two new dispatcher modules (`hooks/concern_env.ts`, `hooks/feedback_policy.ts`) and `src/config/hook-bundle-budget.json`. Under ADR-268 § 4 the change needs a two-provider verdict.

subject: b30cce2dfbf2f4d32b14b7cb2d8c0bf12eca7e561d1ed419f579dce1b8716580

(Base-revision gate digest — CI runs the base copy — over those six files at commit `1157db0a5f`. The head's gate, which no longer lists the budget file, computes `6462eca30a8cfc2660acfd7e05ba7f9cc36ae7df59d3c2160fd64684d7ec2514` over the other five.)

This round changes method. Rounds 1–3 (committed as `…-r1/-r2/-r3-20261120.question.md`) sent deltas, and several points were refused as "not shown". This prompt is self-contained: below are the FULL current text of every gated file except the 1,500-line dispatcher (its full diff against `origin/main` instead), the composition gate's reading and verdict, and the tests that pin each claim. Judge what is here.

## What the change is

1. **Budget** (owner decision, `agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md`, D1/D2, quoting the owner): the byte ratchet goes. `hook-bundle-budget.json` holds a package allowlist (`["yaml"]`) and a backstop at the 2026-11-20 reading plus about 20 %. The composition gate fails on an unlisted package, a package bundled from two directories, an over-backstop bundle, and refuses a metafile it cannot read strictly. The budget file leaves the ratification gate's watched set; token and latency budgets stay. A change to it then merges through branch protection (pull request plus the required Consistency and Tests checks) without a two-provider record — that is D2.
2. **Dispatcher**: the concern environment is hardened once per dispatch scope and reset on drift between concerns (`concern_env.ts`); per-concern feedback files only for non-quiet outcomes, `summary.json` keeps every entry including `raw_exit_code` (`feedback_policy.ts`).
3. **Not gated, for context**: one YAML copy per dispatch (`settings.ts` static import; chunks get the bundle's copy through `bundled_yaml.ts` and the chunk banner); the CLI launcher enables the compile cache before importing the bundle; a runtime load-set test; `hooks_doctor` ranks feedback by recorded run time.

## Round 3 points and where each is answered below

- Nested isolation — `concern_env.ts` `openConcernEnvScope`: a nested scope derives its hardened copy from the ENCLOSING scope's hardened copy, never from the live environment; the live environment is saved and restored on close. Test "a re-entrant dispatch is a scope of its own…" checks the inner concern AND a spawned child do not see the outer concern's variable or `LD_PRELOAD`.
- Stale releases — `enterConcernEnv`'s release acts only while its scope is innermost. Test "a release that outlives its scope does nothing".
- Cleanup replacing the outcome — close and release catch their own failures and report through `reportQuietly`, which itself cannot throw. Test "reporting a cleanup failure never throws, even when stderr does". The dispatcher closes in a `finally` (diff below).
- Byte-count validation — `isByteCount` (non-negative safe integer) on output `bytes` and every input's `bytesInOutput`. Test "refuses byte counts no build could write".
- D2 verification — the gate diff, the workflow diff, and tests: budget-only edit not gated; mixed budget + dispatcher edit still gates the dispatcher; latency budget still gated; a dispatcher diff without a record still refused (`check_kernel_edit_ratified_local_base.test.ts`, unchanged test, budget path swapped for the latency budget).
- `raw_exit_code` — `SUMMARY_KEYS` in the dispatcher diff; asserted from `summary.json` in `egress_stage.test.ts` (excerpt).
- Symlinked aliases — one physical copy reached through two paths is one copy; esbuild reports the resolved path it read, so the rule counts distinct directories it bundled from. No change.

Suites: 135 test files, 2,367 tests (hook, dispatcher, composition, ratification gate); composition self-test 4/4; load-set test green on four hot events.

## What to answer

1. Does any gated file, as shown in full, contain a defect, or weaken a fail-closed guard, an exit-code contract, the hardening of a concern's child processes, or isolation between concerns? File and line.
2. Does the code expand authority beyond the owner's recorded D2?
3. Is each round-3 point closed by what is shown?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## `src/config/hook-bundle-budget.json`, full

````
{
    "_comment": "Package allowlist and one wide backstop for the self-hosted hook bundle (dist/hooks/dispatch.js). Read by src/scripts/check_hook_bundle_composition.ts, which builds the bundle from source with --metafile. WHY: every concern is inlined into one bundle that every hook event loads, so a DEPENDENCY added for one concern is paid by all of them on every dispatch. The incident this exists for was a second YAML parser (95,846 bytes) that reached a release unseen. A new npm package in the bundle is now a red check with one line to add here, reviewed like any dependency. Own-code growth is what features are; it is not gated per byte.",
    "schema_version": 2,
    "registered_at": "2026-10-01",
    "owner": "maintainer",
    "review_by": "2027-10-01",
    "allowed_packages": ["yaml"],
    "allowed_packages_note": "The npm packages allowed to contribute bytes to the bundle. Adding one is a reviewed dependency decision, not a ceiling raise. A second YAML reader is refused by the same rule: only `yaml` is listed.",
    "max_bytes": 1915000,
    "max_bytes_note": "A backstop against slow creep, not a ratchet: the reading on 2026-11-20 (1,595,089 B) plus about 20 %, rounded (owner directive agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md, D1). Expected to fire a few times a year at most; when it does, look at what grew before moving the number. There is no shrink-only rule, no raise log and no per-chunk ceiling any more; the retired file is kept in git at 2eef08c00b and summarised in agents/evidence/analysis/hook-bundle-budget-retired-2026-11-20.md.",
    "what_this_does_not_bound": "Latency: src/config/hook-latency-budget.json owns the wall-clock axis, and a module loaded at runtime outside the bundle is caught by tests/scripts/hook_load_set.test.ts, not here. Nor does it bound dist/install/install.mjs or dist/mcp/server.mjs, which carry their own module graphs."
}
````

## `src/scripts/hooks/concern_env.ts`, full

````
/**
 * concern_env — the hardened environment in-process concerns run under, built
 * ONCE per dispatch instead of once per concern.
 *
 * In-process concerns may spawn their own children (git, dashboard regen), which
 * inherit `process.env`, so they run under the same hardened copy the spawn path
 * applies (`hardenedSpawnEnv`). The dispatcher used to copy the environment,
 * rebuild the hardened copy, delete and reassign, then restore — per concern.
 * Measured 0.2 ms per concern at 40 variables and up to 2 ms at 235, with 15 to
 * 20 concerns on a tool event (road-to-a-hook-system-that-pays-for-what-it-does
 * 2.3).
 *
 * Now: the dispatch opens one scope before its concern loop (saved environment
 * plus hardened copy, applied once) and closes it after. Each concern leaves
 * through {@link enterConcernEnv}'s release, which compares the environment
 * against the hardened copy and resets it only when the concern changed it —
 * so a variable one concern sets never reaches the next, which is the isolation
 * the per-concern rebuild bought.
 *
 * Outside an open scope (a direct call, a test) `enterConcernEnv` falls back to
 * the old per-concern save, harden and restore, so no caller depends on the
 * scope existing.
 */
import { hardenedSpawnEnv } from '../_lib/spawn_env.js';

interface Scope {
    readonly prev: NodeJS.ProcessEnv;
    readonly hardened: NodeJS.ProcessEnv;
}

/** Innermost last. A nested dispatch (a re-entry from inside a concern) pushes its own scope. */
const stack: Scope[] = [];

/** Make `process.env` equal `target`: drop keys it lacks, set the ones that differ. */
function replaceEnv(target: NodeJS.ProcessEnv): void {
    for (const k of Object.keys(process.env)) {
        if (!Object.hasOwn(target, k)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(target)) {
        if (v !== undefined && process.env[k] !== v) process.env[k] = v;
    }
}

function drifted(target: NodeJS.ProcessEnv): boolean {
    const keys = Object.keys(process.env);
    if (keys.length !== Object.keys(target).length) return true;
    for (const k of keys) {
        if (!Object.hasOwn(target, k) || process.env[k] !== target[k]) return true;
    }
    return false;
}

/** Report on stderr without ever throwing: a cleanup path must not replace the dispatch's outcome. */
export function reportQuietly(what: string, err: unknown): void {
    try {
        process.stderr.write(`concern_env: ${what}: ${err instanceof Error ? err.message : String(err)}\n`);
    } catch {
        /* nothing left to report through */
    }
}

/**
 * Open a dispatch scope. Returns the close function, which puts back the
 * environment as it was when the scope opened and never throws (a failed
 * restore is reported, so a `finally` that calls it cannot replace the
 * dispatch's own outcome). The caller closes it in a `finally`, so a dispatch
 * that throws still restores and leaves no scope open.
 *
 * The hardened copy a scope applies is derived from the ENCLOSING scope's
 * hardened copy when there is one, never from the live environment: a
 * synchronous re-entry into dispatch from inside a concern must not hand that
 * concern's changes to the inner concerns. The live environment is still saved,
 * so the outer concern gets its own environment back when the inner dispatch
 * returns.
 */
export function openConcernEnvScope(packageRoot: string): () => void {
    const prev = { ...process.env };
    const enclosing = stack[stack.length - 1];
    const hardened =
        enclosing === undefined
            ? hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot })
            : { ...enclosing.hardened, AGENT_CONFIG_PACKAGE_ROOT: packageRoot };
    const scope: Scope = { prev, hardened };
    replaceEnv(hardened);
    stack.push(scope);
    let closed = false;
    return () => {
        if (closed) return;
        closed = true;
        const at = stack.lastIndexOf(scope);
        // Already ended by an enclosing scope's close: that close restored an
        // older environment, which this one must not overwrite.
        if (at < 0) return;
        stack.splice(at);
        try {
            replaceEnv(scope.prev);
        } catch (err) {
            reportQuietly('environment restore failed', err);
        }
    };
}

/**
 * Enter the environment for one concern; call the returned function when it has
 * run. The release resets only while its scope is still the innermost one: a
 * release that outlives its scope (the scope already closed) does nothing, so it
 * can never put an older hardened copy over the current scope.
 */
export function enterConcernEnv(packageRoot: string): () => void {
    const scope = stack[stack.length - 1];
    if (scope === undefined) return openConcernEnvScope(packageRoot);
    return () => {
        if (stack[stack.length - 1] !== scope) return;
        try {
            if (drifted(scope.hardened)) replaceEnv(scope.hardened);
        } catch (err) {
            reportQuietly('environment reset failed', err);
        }
    };
}
````

## `src/scripts/hooks/feedback_policy.ts`, full

````
/**
 * feedback_policy — which concern outcomes get their own feedback file.
 *
 * The dispatcher's per-session `summary.json` carries every concern's entry.
 * A per-concern `<concern>.json` used to be written for every concern on every
 * dispatch: about 16 locked atomic writes per tool event, each overwritten by
 * the next dispatch (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
 * Only an outcome worth looking at on its own keeps a file now; `hooks_doctor`
 * falls back to the summary for the rest.
 */
import { EXIT_ALLOW } from './exit_codes.js';

/** An entry that allowed, was not resolved from a crash, and gave no reason. */
export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean {
    return (
        entry['exit_code'] === EXIT_ALLOW &&
        entry['raw_exit_code'] === EXIT_ALLOW &&
        entry['decision'] === 'allow' &&
        (entry['reason'] ?? null) === null
    );
}
````

## `tests/scripts/hooks/concern_env.test.ts`, full

````
// concern_env — the hardened environment is built once per dispatch, and a
// variable one concern sets never reaches the next
// (road-to-a-hook-system-that-pays-for-what-it-does 2.3).
import { spawnSync } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enterConcernEnv, openConcernEnvScope, reportQuietly } from '../../../src/scripts/hooks/concern_env.js';

const ROOT = '/pkg-root';
let saved: NodeJS.ProcessEnv;

beforeEach(() => {
    saved = { ...process.env };
    process.env['LD_PRELOAD'] = '/evil.so';
    process.env['CONCERN_ENV_KEEP'] = 'kept';
});

afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
});

describe('concern_env — one scope per dispatch', () => {
    it('hardens once: injection vectors are gone inside the scope and back after it', () => {
        const close = openConcernEnvScope(ROOT);
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        expect(process.env['AGENT_CONFIG_PACKAGE_ROOT']).toBe(ROOT);
        expect(process.env['CONCERN_ENV_KEEP']).toBe('kept');
        close();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        expect(process.env['AGENT_CONFIG_PACKAGE_ROOT']).toBe(saved['AGENT_CONFIG_PACKAGE_ROOT']);
    });

    it('a variable one concern sets, changes or deletes does not reach the next concern', () => {
        const close = openConcernEnvScope(ROOT);
        const leaveA = enterConcernEnv(ROOT);
        process.env['LEAKED_BY_A'] = '1';
        process.env['CONCERN_ENV_KEEP'] = 'changed';
        delete process.env['AGENT_CONFIG_PACKAGE_ROOT'];
        leaveA();
        const leaveB = enterConcernEnv(ROOT);
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
        expect(process.env['CONCERN_ENV_KEEP']).toBe('kept');
        expect(process.env['AGENT_CONFIG_PACKAGE_ROOT']).toBe(ROOT);
        leaveB();
        close();
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
    });

    it('outside a scope, a concern still runs hardened and restores what it found', () => {
        const leave = enterConcernEnv(ROOT);
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        process.env['LEAKED_BY_A'] = '1';
        leave();
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });

    it('a dispatch that throws inside the scope still restores, and the next dispatch opens a real scope', () => {
        const dispatch = (fail: boolean): void => {
            const close = openConcernEnvScope(ROOT);
            try {
                const leave = enterConcernEnv(ROOT);
                process.env['LEAKED_BY_A'] = '1';
                if (fail) throw new Error('concern loop blew up');
                leave();
            } finally {
                close();
            }
        };
        expect(() => dispatch(true)).toThrow(/blew up/);
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
        const close = openConcernEnvScope(ROOT);
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        close();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });

    it('an inherited name on the hardened copy does not keep a variable alive', () => {
        const close = openConcernEnvScope(ROOT);
        const leave = enterConcernEnv(ROOT);
        process.env['toString'] = 'set-by-concern';
        leave();
        expect(Object.hasOwn(process.env, 'toString')).toBe(false);
        close();
    });

    it('a re-entrant dispatch is a scope of its own: inner concerns and their children never see the outer concern\'s changes', () => {
        const childSees = (name: string): string =>
            spawnSync(process.execPath, ['-e', `process.stdout.write(process.env[${JSON.stringify(name)}] ?? 'unset')`], { encoding: 'utf-8' }).stdout;
        const closeOuter = openConcernEnvScope(ROOT);
        const leaveOuter = enterConcernEnv(ROOT);
        process.env['OUTER_CONCERN_SET'] = 'outer';
        // The outer concern re-enters dispatch synchronously.
        const closeInner = openConcernEnvScope(ROOT);
        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined();
        expect(childSees('OUTER_CONCERN_SET')).toBe('unset');
        expect(childSees('LD_PRELOAD')).toBe('unset');
        const leaveInnerA = enterConcernEnv(ROOT);
        process.env['INNER_A_SET'] = 'a';
        leaveInnerA();
        const leaveInnerB = enterConcernEnv(ROOT);
        expect(process.env['INNER_A_SET']).toBeUndefined();
        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined();
        leaveInnerB();
        closeInner();
        expect(process.env['OUTER_CONCERN_SET']).toBe('outer'); // the outer concern gets its own env back
        leaveOuter();
        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined(); // and is reset on leaving, as any concern
        closeOuter();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });

    it('a release that outlives its scope does nothing', () => {
        const closeOuter = openConcernEnvScope(ROOT);
        const closeInner = openConcernEnvScope(ROOT);
        const staleRelease = enterConcernEnv(ROOT); // bound to the inner scope
        closeInner();
        process.env['OUTER_LEVEL_STATE'] = 'kept';
        staleRelease();
        expect(process.env['OUTER_LEVEL_STATE']).toBe('kept');
        closeOuter();
    });

    it('reporting a cleanup failure never throws, even when stderr does', () => {
        const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {
            throw new Error('stderr closed');
        });
        try {
            expect(() => reportQuietly('environment restore failed', new Error('x'))).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('closing twice, or out of order, never leaves a scope behind', () => {
        const closeOuter = openConcernEnvScope(ROOT);
        const closeInner = openConcernEnvScope(ROOT);
        closeOuter();
        closeInner();
        closeOuter();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        const leave = enterConcernEnv(ROOT); // no scope open: the per-concern fallback
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        leave();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });
});
````

## `tests/scripts/hooks/feedback_policy.test.ts`, full

````
// feedback_policy — only an outcome worth reading on its own keeps a
// per-concern feedback file (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
import { describe, expect, it } from 'vitest';

import { isQuietAllow } from '../../../src/scripts/hooks/feedback_policy.js';

const allow = { concern: 'c', exit_code: 0, raw_exit_code: 0, decision: 'allow', reason: null };

describe('feedback_policy — isQuietAllow', () => {
    it('a plain allow is quiet', () => {
        expect(isQuietAllow(allow)).toBe(true);
        expect(isQuietAllow({ ...allow, reason: undefined })).toBe(true);
    });

    it('a warn, a block, a crash resolved to allow, a non-allow decision or a reason keep their file', () => {
        expect(isQuietAllow({ ...allow, exit_code: 1, decision: 'warn' })).toBe(false);
        expect(isQuietAllow({ ...allow, exit_code: 2, decision: 'block' })).toBe(false);
        expect(isQuietAllow({ ...allow, raw_exit_code: 3 })).toBe(false);
        expect(isQuietAllow({ ...allow, decision: 'ask' })).toBe(false);
        expect(isQuietAllow({ ...allow, reason: 'context injected' })).toBe(false);
    });
});
````

## `src/scripts/check_hook_bundle_composition.ts` — the metafile reading and the verdict (not gated; excerpt)

````ts
/** A byte count esbuild could have written: a non-negative safe integer. */
function isByteCount(v: unknown): v is number {
    return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

/** The entry the bundle is built from; the metafile output carrying it is the one measured. */
export const ENTRY_REL = 'src/scripts/hooks/dispatch_entry.ts';

/**
 * The directory a package's bytes come from (`…/node_modules/<pkg>`), so two
 * copies of one package name — a nested duplicate — count as two roots.
 */
export function packageRoot(modulePath: string): string | null {
    const pkg = owningPackage(modulePath);
    if (pkg === null) return null;
    const at = modulePath.lastIndexOf('node_modules/');
    return modulePath.slice(0, at + 'node_modules/'.length + pkg.length);
}

/**
 * Parse an esbuild metafile and attribute the output built from {@link ENTRY_REL}.
 *
 * Refuses rather than defaulting: an output with no `bytes`, no `inputs`, or an
 * input with no `bytesInOutput` would otherwise read as a clean bundle, which is
 * the silent green this gate exists to replace. With `requireEntry` (the gate's
 * own build) the output MUST be the one built from {@link ENTRY_REL}; without
 * it (a `--metafile` fixture) a single entry output is accepted whatever its
 * entry is named.
 */
export function analyzeMetafile(json: string, opts: { requireEntry?: boolean } = {}): Analysis {
    const meta = JSON.parse(json) as {
        outputs?: Record<string, { entryPoint?: string; bytes?: number; inputs?: Record<string, { bytesInOutput?: number }> }>;
    };
    const entries = Object.values(meta.outputs ?? {}).filter((o) => typeof o.entryPoint === 'string');
    const out =
        entries.find((o) => o.entryPoint === ENTRY_REL) ??
        (opts.requireEntry !== true && entries.length === 1 ? entries[0] : undefined);
    if (out === undefined) {
        throw new Error(
            entries.length === 0
                ? 'metafile carries no entry-point output — refusing to report a composition for a build that produced nothing'
                : `metafile carries ${String(entries.length)} entry output(s) and none is ${ENTRY_REL}`,
        );
    }
    if (!isByteCount(out.bytes) || out.inputs === undefined || Object.keys(out.inputs).length === 0) {
        throw new Error('the entry output carries no byte count or no inputs — refusing to read it as an empty bundle');
    }
    const packageBytes = new Map<string, number>();
    const roots = new Map<string, Set<string>>();
    for (const [p, v] of Object.entries(out.inputs)) {
        if (!isByteCount(v.bytesInOutput)) {
            throw new Error(`input ${p} carries no valid bytesInOutput — refusing to attribute it`);
        }
        const pkg = owningPackage(p);
        const bytes = v.bytesInOutput;
        if (pkg === null || bytes <= 0) continue;
        packageBytes.set(pkg, (packageBytes.get(pkg) ?? 0) + bytes);
        const root = packageRoot(p);
        if (root !== null) roots.set(pkg, (roots.get(pkg) ?? new Set<string>()).add(root));
    }
    const duplicated = [...roots].filter(([, r]) => r.size > 1).map(([pkg]) => pkg).sort();
    return { bytes: out.bytes, modules: Object.keys(out.inputs).length, packageBytes, duplicated };
}

/** Packages contributing bytes that the budget does not list, sorted. */
export function unlistedPackages(a: Analysis, budget: Budget): string[] {
    const allowed = new Set(budget.allowedPackages);
    return [...a.packageBytes.keys()].filter((p) => !allowed.has(p)).sort();
}

/** Read the committed budget. Throws rather than defaulting — a guessed ceiling bounds nothing. */
export function readBudget(root: string): Budget {
    const raw = JSON.parse(fs.readFileSync(path.join(root, BUDGET_REL), 'utf-8')) as Record<string, unknown>;
    const maxBytes = raw['max_bytes'];
    const allowed = raw['allowed_packages'];
    if (typeof maxBytes !== 'number' || !Number.isInteger(maxBytes) || maxBytes <= 0) {
        throw new Error(`${BUDGET_REL}: max_bytes must be a positive integer, got ${JSON.stringify(maxBytes)}`);
    }
    if (!Array.isArray(allowed) || !allowed.every((p) => typeof p === 'string' && p !== '')) {
        throw new Error(`${BUDGET_REL}: allowed_packages must be a list of package names, got ${JSON.stringify(allowed)}`);
    }
    return { maxBytes, allowedPackages: allowed as string[] };
}

/** Findings, one line each. Empty means within budget. */
export function verdict(a: Analysis, budget: Budget): string[] {
    const findings: string[] = [];
    const unlisted = unlistedPackages(a, budget);
    if (unlisted.length > 0) {
        const detail = unlisted.map((p) => `${p} (${String(a.packageBytes.get(p) ?? 0)} B)`).join(', ');
        findings.push(
            `npm package(s) in the bundle that ${BUDGET_REL} does not list: ${detail}. Every dispatch loads ` +
                'them. Use a package the bundle already carries, load it lazily outside the bundle, or add it to ' +
                '`allowed_packages` as a reviewed dependency decision.',
        );
    }
    if (a.duplicated.length > 0) {
        findings.push(
            `package(s) bundled from more than one copy on disk: ${a.duplicated.join(', ')}. Every dispatch parses ` +
                'both. Dedupe the dependency so one copy is bundled.',
        );
    }
    if (a.bytes > budget.maxBytes) {
        findings.push(
            `bundle is ${String(a.bytes)} bytes, backstop is ${String(budget.maxBytes)} ` +
                `(over by ${String(a.bytes - budget.maxBytes)}). Look at what grew before moving max_bytes in ${BUDGET_REL}.`,
        );
    }
    return findings;
}

````

## `tests/scripts/hook_bundle_composition.test.ts` — the strict-reading tests (excerpt)

````ts
    it('fails a package bundled from two copies on disk, a nested duplicate under the same name', () => {
        const a = analyzeMetafile(
            metafile(1000, { 'node_modules/yaml/dist/index.js': 600, 'node_modules/x/node_modules/yaml/dist/index.js': 400 }),
        );
        expect(a.duplicated).toEqual(['yaml']);
        expect(verdict(a, BUDGET).some((f) => f.includes('more than one copy'))).toBe(true);
    });

    it('refuses an entry output with no byte count or no inputs instead of reading it as empty', () => {
        const noBytes = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', inputs: { 'src/x.ts': { bytesInOutput: 1 } } } } });
        const noInputs = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 10, inputs: {} } } });
        expect(() => analyzeMetafile(noBytes)).toThrow(/byte count or no inputs/u);
        expect(() => analyzeMetafile(noInputs)).toThrow(/byte count or no inputs/u);
    });

    it('measures the dispatch entry when the metafile carries several entry outputs', () => {
        const json = JSON.stringify({
            outputs: {
                other: { entryPoint: 'src/other.ts', bytes: 5, inputs: { 'src/other.ts': { bytesInOutput: 5 } } },
                main: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 7, inputs: { 'src/a.ts': { bytesInOutput: 7 } } },
            },
        });
        expect(analyzeMetafile(json).bytes).toBe(7);
        const ambiguous = JSON.stringify({
            outputs: {
                a: { entryPoint: 'src/a.ts', bytes: 5, inputs: { 'src/a.ts': { bytesInOutput: 5 } } },
                b: { entryPoint: 'src/b.ts', bytes: 7, inputs: { 'src/b.ts': { bytesInOutput: 7 } } },
            },
        });
        expect(() => analyzeMetafile(ambiguous)).toThrow(/none is/u);
    });

    it('on the gate\'s own build, a single output built from another entry is refused, not measured', () => {
        const wrong = JSON.stringify({ outputs: { o: { entryPoint: 'src/other.ts', bytes: 5, inputs: { 'src/other.ts': { bytesInOutput: 5 } } } } });
        expect(() => analyzeMetafile(wrong, { requireEntry: true })).toThrow(/none is/u);
        expect(analyzeMetafile(wrong).bytes).toBe(5);
    });

    it('refuses byte counts no build could write: negative, fractional, unsafe', () => {
        for (const bad of [-1, 1.5, Number.MAX_SAFE_INTEGER + 2]) {
            const out = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: bad, inputs: { 'src/a.ts': { bytesInOutput: 1 } } } } });
            const inp = JSON.stringify({ outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 9, inputs: { 'src/a.ts': { bytesInOutput: bad } } } } });
            expect(() => analyzeMetafile(out), String(bad)).toThrow();
            expect(() => analyzeMetafile(inp), String(bad)).toThrow();
        }
    });

    it('refuses an input with no bytesInOutput instead of counting it as zero', () => {
        const json = JSON.stringify({
            outputs: { o: { entryPoint: 'src/scripts/hooks/dispatch_entry.ts', bytes: 9, inputs: { 'node_modules/left-pad/x.js': {} } } },
        });
        expect(() => analyzeMetafile(json)).toThrow(/bytesInOutput/u);
    });

````

## Diffs against `origin/main`: the ratification gate, its workflow, the dispatcher, and the gate tests

````diff
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index db12c9d2ac..623c340e1d 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -249,14 +249,13 @@ jobs:
       - name: Verify the host table's format column names only emitted paths
         run: ./scripts-run src/scripts/check_host_format_column --quiet
 
-      # One YAML reader in the hook bundle, and a byte ceiling on it. Unlike its
-      # two siblings (`check_hook_bundle_freshness` / `_content`) this one is NOT
-      # local-only: it builds its own bundle from source with `--metafile`
-      # instead of reading the untracked `dist/hooks/dispatch.js`, so what it
-      # bounds is a property of the commit rather than of one machine. That is
-      # the whole reason it can fail a pull request, which is where the second
-      # YAML parser it exists to catch would have been caught.
-      - name: Verify the hook bundle carries one YAML reader and stays under its byte ceiling
+      # Only allowlisted npm packages in the hook bundle, and a wide byte
+      # backstop. Unlike its two siblings (`check_hook_bundle_freshness` /
+      # `_content`) this one is NOT local-only: it builds its own bundle from
+      # source with `--metafile`, so what it bounds is a property of the commit
+      # rather than of one machine. That is why it can fail a pull request,
+      # which is where the second YAML parser it exists to catch belongs.
+      - name: Verify the hook bundle carries only allowlisted packages and stays under its backstop
         run: ./scripts-run src/scripts/check_hook_bundle_composition
 
       - name: Verify README size, word and time-to-first-command budgets
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index fb1713f367..2e9b229479 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -34,7 +34,7 @@
  * `host_lowering.yaml`, their compiled siblings `hook_manifest.json` and
  * `host_lowering.json`, the dispatcher `hooks/dispatch_hook.ts`, the
  * kernel-rule list `_lib/kernel_rules.ts`, a `*-dispatcher.sh`, the token,
- * latency and bundle budget files (see `PLUMBING_SOURCE_RE`), and every module
+ * and latency budget files (see `PLUMBING_SOURCE_RE`), and every module
  * the dispatcher imports that decides an exit code (derived at run time, see
  * `derivedPlumbing`) — a rule of the high-consequence class beyond the kernel
  * (the members of `rule-consequence-class.json`, see `CONSEQUENCE_CLASS_PATH`)
@@ -307,7 +307,7 @@ const GOVERNANCE_HOOK_RE = /^src\/scripts\/hooks\/block_[a-z0-9_]+\.ts$/;
  * is the diff where only the JSON moves.
  */
 const PLUMBING_SOURCE_RE =
-    /^(?:src\/scripts\/hook_manifest\.(?:yaml|json)|src\/scripts\/hooks\/host_lowering\.(?:yaml|json)|src\/scripts\/hooks\/dispatch_hook\.ts|src\/scripts\/_lib\/kernel_rules\.ts|src\/scripts\/hooks\/[a-z0-9-]+-dispatcher\.sh|src\/config\/hook-(?:token|latency|bundle)-budget\.json)$/;
+    /^(?:src\/scripts\/hook_manifest\.(?:yaml|json)|src\/scripts\/hooks\/host_lowering\.(?:yaml|json)|src\/scripts\/hooks\/dispatch_hook\.ts|src\/scripts\/_lib\/kernel_rules\.ts|src\/scripts\/hooks\/[a-z0-9-]+-dispatcher\.sh|src\/config\/hook-(?:token|latency)-budget\.json)$/;
 
 /**
  * The derived half of the plumbing set: every module in the static import
@@ -324,9 +324,11 @@ const PLUMBING_SOURCE_RE =
  * Concerns stay outside: the walk stops at the concern table, and a governance
  * concern is already gated by `GOVERNANCE_HOOK_RE`.
  *
- * `hook-bundle-budget.json` joins the pattern for D3: its ceiling was raised on
- * its own registration day, and a raised ceiling is a looser budget reached one
- * file earlier than the bundle it bounds.
+ * `hook-bundle-budget.json` joined the pattern for D3 (2026-10) and LEFT it on
+ * 2026-11-20 (owner directive `2026-11-20-hook-bundle-budget-and-hook-economy`,
+ * D2): the file now holds a package allowlist and a wide backstop rather than a
+ * shrink-only ceiling, so a change to it is a reviewed dependency decision, not
+ * a loosened kernel budget. The token and latency budgets stay watched.
  */
 let _repoDerived: readonly string[] | null = null;
 export function derivedPlumbing(root: string = REPO): readonly string[] {
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 16ac1faf33..b5c9981754 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -73,6 +73,8 @@ import { _fallback_yaml } from './fallback_yaml.js';
 import { detectSurface } from '../_lib/surface.js';
 import { recordCapture, recordOpportunity } from "../_lib/collector_denominator.js";
 import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN, EXIT_USAGE } from './exit_codes.js';
+import { enterConcernEnv, openConcernEnvScope } from './concern_env.js';
+import { isQuietAllow } from './feedback_policy.js';
 export { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN };
 export { _fallback_yaml } from './fallback_yaml.js';
 
@@ -621,11 +623,11 @@ function _run_concern_inproc(
   const prevStderrWrite = process.stderr.write;
   const prevArgv = process.argv;
   const prevCwd = process.cwd();
-  const prevEnv = { ...process.env };
 
   const started = performance.now();
   let rc = 0;
   setHookStdinOverride(_compactJsonDumps(envelope));
+  const leaveEnv = enterConcernEnv(REPO_ROOT);
   process.stdout.write = makeCapture((s) => {
     out += s;
   });
@@ -634,13 +636,7 @@ function _run_concern_inproc(
   });
   try {
     process.argv = [prevArgv[0] as string, scriptAbs, ...argsList];
-    // Same env-hardening the spawn path applied — concerns may spawn their
-    // own children (dashboard regen, git), which inherit process.env.
-    const hardened = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT });
-    for (const k of Object.keys(process.env)) {
-      if (!(k in hardened)) delete process.env[k];
-    }
-    Object.assign(process.env, hardened);
+    // Hardened once per dispatch, reset only if this concern changed it: concern_env.ts.
     if (workspace !== prevCwd && _isDir(workspace)) {
       process.chdir(workspace);
     }
@@ -661,10 +657,7 @@ function _run_concern_inproc(
     process.stdout.write = prevStdoutWrite;
     process.stderr.write = prevStderrWrite;
     process.argv = prevArgv;
-    for (const k of Object.keys(process.env)) {
-      if (!(k in prevEnv)) delete process.env[k];
-    }
-    Object.assign(process.env, prevEnv);
+    leaveEnv();
     try {
       if (process.cwd() !== prevCwd) process.chdir(prevCwd);
     } catch {
@@ -822,6 +815,7 @@ function _write_feedback(
     return;
   }
   for (const entry of entries) {
+    if (isQuietAllow(entry)) continue; // summary.json carries it: feedback_policy.ts
     const target = path.join(fb_dir, `${entry["concern"]}.json`);
     try {
       atomic_write_json(target, entry);
@@ -835,6 +829,7 @@ function _write_feedback(
   const SUMMARY_KEYS = new Set([
     "concern",
     "exit_code",
+    "raw_exit_code",
     "severity",
     "decision",
     "reason",
@@ -1297,6 +1292,8 @@ export function main(argv?: string[]): number {
     keep_by_concern.map(([, keep]) => keep),
     egress.placeholder,
   );
+  const closeConcernEnv = openConcernEnvScope(REPO_ROOT);
+  try {
     for (const [concern, keep_classes] of keep_by_concern) {
       if (!_concern_matches_tool(concern, tool_name)) {
         continue;
@@ -1401,6 +1398,9 @@ export function main(argv?: string[]): number {
         payload_stubs: stubs_served,
       });
     }
+  } finally {
+    closeConcernEnv();
+  }
   const final_rc = _reduce(rcs);
   writeConcernTimings(String(envelope["event"] ?? ""), String(envelope["platform"] ?? ""), timing_samples);
   _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at);
diff --git a/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts b/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
index f4e013fa68..0ca32e43a8 100644
--- a/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_import_closure.test.ts
@@ -98,14 +98,22 @@ describe('the fence follows the dispatcher import closure', () => {
         expect(evaluate([UNRELATED_CONCERN], root, 2).exitCode).toBe(0);
     });
 
-    it('the stdin-failure policy and the bundle budget are watched too', () => {
+    it('the stdin-failure policy and the latency budget are watched; the bundle budget is not', () => {
         const gated = classifyPaths([
             'src/scripts/hooks/stdin_failure_policy.ts',
+            'src/config/hook-latency-budget.json',
             'src/config/hook-bundle-budget.json',
         ]);
         expect(gated.plumbing).toEqual([
             'src/scripts/hooks/stdin_failure_policy.ts',
-            'src/config/hook-bundle-budget.json',
+            'src/config/hook-latency-budget.json',
+        ]);
+    });
+
+    it('a budget-only edit is not gated; a mixed budget and dispatcher edit still gates the dispatcher', () => {
+        expect(classifyPaths(['src/config/hook-bundle-budget.json']).plumbing).toEqual([]);
+        expect(classifyPaths(['src/config/hook-bundle-budget.json', 'src/scripts/hooks/dispatch_hook.ts']).plumbing).toEqual([
+            'src/scripts/hooks/dispatch_hook.ts',
         ]);
     });
 
diff --git a/tests/scripts/check_kernel_edit_ratified_local_base.test.ts b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
index 1d6b19ed9d..a4a509c5f8 100644
--- a/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
@@ -215,7 +215,7 @@ describe('a module joining the dispatcher closure', () => {
 
     it('a plumbing file matched by name, outside any closure, is gated in both shapes', () => {
         const base = buildChange();
-        const budget = 'src/config/hook-bundle-budget.json';
+        const budget = 'src/config/hook-latency-budget.json';
         write(budget, '{ "ceiling": 1 }\n');
         commitAll(root, 'budget');
         git(['worktree', 'add', '--detach', baseDir, base]);
diff --git a/tests/scripts/hooks/egress_stage.test.ts b/tests/scripts/hooks/egress_stage.test.ts
index 473e75e6ba..f73b39fe1e 100644
--- a/tests/scripts/hooks/egress_stage.test.ts
+++ b/tests/scripts/hooks/egress_stage.test.ts
@@ -442,7 +442,11 @@ describe("end to end through the dispatcher", () => {
     // The rewriting fixture did run and reply: without this the assertion above
     // would also pass for a fixture that never started.
     const dir = feedback_dir(path.join(ws, "agents", "runtime", "state"), "egress-rewrite");
-    const entry = JSON.parse(fs.readFileSync(path.join(dir, "rewriter.json"), "utf8")) as Record<string, unknown>;
+    // A quiet allow has no file of its own (feedback_policy.ts); summary.json carries every entry.
+    const summary = JSON.parse(fs.readFileSync(path.join(dir, "summary.json"), "utf8")) as {
+      invocations: Array<{ concerns: Array<Record<string, unknown>> }>;
+    };
+    const entry = summary.invocations.flatMap((i) => i.concerns).find((c) => c["concern"] === "rewriter") as Record<string, unknown>;
     expect(entry["raw_exit_code"]).toBe(0);
     expect(entry["decision"]).toBe("allow");
   });
````
