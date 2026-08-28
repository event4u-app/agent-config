#!/usr/bin/env tsx
/**
 * A mid-session mutation of a declared prefix-stable surface is a violation.
 *
 * WHY
 * ---
 * `check_kernel_prefix_stability` guards the kernel prefix at AUTHORING time —
 * it compares a committed snapshot and re-anchors in the same PR. `payload_hash_drift`
 * measures prefix churn AFTER the fact, from an audit ledger. Neither can see the
 * case this gate exists for: a hook, a script, or (once one exists) a resident
 * process rewriting a prefix-stable surface DURING a session, which invalidates
 * the prompt cache for the rest of it and makes the next call pay the cache-WRITE
 * rate over the whole prefix.
 *
 * That is the runtime half, and until this gate it was prose.
 *
 * WHAT IT CHECKS
 * --------------
 * For every concern in `src/scripts/hook_manifest.yaml` bound on at least one
 * MID-SESSION slot — any slot that is not a declared re-arm event — the gate reads
 * the concern's script and looks for evidence that it writes inside a surface
 * declared in `_lib/prefix_stable_surfaces.ts`. Evidence is a violation unless the
 * concern declares `re_arm: <event>`, naming the boundary at which a rebuilt
 * prefix is expected and paid for once.
 *
 * THE LIST IS LOADED, NEVER RESTATED. Both this gate and
 * `check_preamble_payload_budget` import `PREFIX_STABLE_SURFACES`. Two lists
 * describing one boundary is the drift shape this repository has already paid for.
 *
 * FAIL-CLOSED ON UNDECIDABLE (council 2026-08-28, 2/2)
 * ----------------------------------------------------
 * A write whose target is a runtime variable cannot be classified by reading the
 * source. Classifying that as "fine" turns every dynamic path into an accidental
 * exemption. So: a dynamic write target in a script that ALSO carries a literal
 * resolving into a declared surface is reported as `undecidable` and fails. A
 * dynamic write in a script with no such literal is not reported — the gate does
 * not claim to know what it cannot see, and reporting every dynamic write in every
 * hook would be a gate nobody can keep green.
 *
 * Exit codes: 0 clean · 1 violation(s) · 2 misuse / unreadable manifest.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_prefix_stable_mutation [--root <dir>] [--json] [--quiet]
 *   ./scripts-run src/scripts/check_prefix_stable_mutation --self-test
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { PREFIX_STABLE_SURFACES, RE_ARM_EVENTS, prefixStableRoots, surfaceFor } from './_lib/prefix_stable_surfaces.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

/** Write-shaped calls. A read never invalidates a cache; only a write does. */
const WRITE_CALLS = [
    'writeFileSync',
    'appendFileSync',
    'createWriteStream',
    'renameSync',
    'unlinkSync',
    'rmSync',
    'rmdirSync',
    'cpSync',
    'copyFileSync',
    'truncateSync',
    'writeFile',
    'appendFile',
    'outputFileSync',
] as const;

export interface Finding {
    concern: string;
    script: string;
    slots: string[];
    kind: 'literal' | 'undecidable';
    surface: string;
    evidence: string;
}

export interface Verdict {
    scanned: number;
    findings: Finding[];
    midSessionConcerns: number;
}

interface ConcernSpec {
    script?: unknown;
    re_arm?: unknown;
}

/** Yaml is already a dependency of the manifest linter; reuse the same reader shape. */
function loadManifest(root: string): { concerns: Record<string, ConcernSpec>; platforms: Record<string, Record<string, string[]>> } {
    const file = path.join(root, 'src', 'scripts', 'hook_manifest.yaml');
    const raw = fs.readFileSync(file, 'utf-8');
    // Minimal, dependency-free parse of the two shapes this gate needs. The full
    // schema is `lint_hook_manifest`'s business; duplicating a YAML dependency
    // here would add a second parser to disagree with.
    const out = spawnSync(
        process.execPath,
        ['-e', 'const y=require("js-yaml");let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=y.load(s);process.stdout.write(JSON.stringify({concerns:d.concerns||{},platforms:d.platforms||{}}))})'],
        { input: raw, encoding: 'utf-8', cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 },
    );
    if (out.status !== 0 || !out.stdout) {
        throw new Error(`hook_manifest.yaml could not be parsed: ${out.stderr || 'no output'}`);
    }
    return JSON.parse(out.stdout) as { concerns: Record<string, ConcernSpec>; platforms: Record<string, Record<string, string[]>> };
}

/** Every slot each concern is bound on, across every platform. */
export function slotsByConcern(platforms: Record<string, Record<string, string[]>>): Map<string, Set<string>> {
    const m = new Map<string, Set<string>>();
    for (const slots of Object.values(platforms)) {
        if (slots === null || typeof slots !== 'object') continue;
        for (const [slot, names] of Object.entries(slots)) {
            if (!Array.isArray(names)) continue;
            for (const n of names) {
                const set = m.get(n) ?? new Set<string>();
                set.add(slot);
                m.set(n, set);
            }
        }
    }
    return m;
}

/** Slots that are NOT re-arm boundaries — i.e. fire inside a live session. */
export function midSessionSlots(slots: Iterable<string>): string[] {
    return [...slots].filter((s) => !RE_ARM_EVENTS.includes(s)).sort();
}

/** All string literals in a source fragment, in order. */
function literals(src: string): string[] {
    const out: string[] = [];
    const re = /'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`$\\\n]*)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) out.push(m[1] ?? m[2] ?? m[3] ?? '');
    return out;
}

/** The first argument expression of each write-shaped call in `src`. */
export function writeTargets(src: string): string[] {
    const out: string[] = [];
    for (const call of WRITE_CALLS) {
        const re = new RegExp(`\\b${call}\\s*\\(`, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
            let depth = 1;
            let i = m.index + m[0].length;
            const start = i;
            while (i < src.length && depth > 0) {
                const ch = src[i];
                if (ch === '(' || ch === '[' || ch === '{') depth += 1;
                else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
                else if (ch === ',' && depth === 1) break;
                i += 1;
            }
            out.push(src.slice(start, i));
        }
    }
    return out;
}

/**
 * Classify one script. Returns findings for this concern.
 *
 * `literal`     — a write whose own argument carries a literal resolving into a
 *                 declared surface. Unambiguous.
 * `undecidable` — a write with no classifiable literal, in a file that carries a
 *                 surface literal somewhere. Fails closed.
 */
export function classifyScript(source: string): Array<{ kind: 'literal' | 'undecidable'; surface: string; evidence: string }> {
    const found: Array<{ kind: 'literal' | 'undecidable'; surface: string; evidence: string }> = [];
    const targets = writeTargets(source);
    if (targets.length === 0) return found;

    // A file-wide literal that resolves into a surface — the fail-closed trigger.
    const fileSurfaces = literals(source)
        .map((l) => ({ lit: l, s: surfaceFor(l) }))
        .filter((x) => x.s !== null);

    let sawDynamic = false;
    for (const t of targets) {
        const lits = literals(t);
        // `path.join('dist','agent-src','rules', …)` — join the literal segments too.
        const joined = lits.join('/');
        const hit = lits.map((l) => surfaceFor(l)).find((s) => s !== null) ?? surfaceFor(joined);
        if (hit) {
            found.push({ kind: 'literal', surface: hit.id, evidence: t.trim().slice(0, 120) });
        } else if (lits.length === 0) {
            sawDynamic = true;
        }
    }

    const firstSurface = fileSurfaces[0];
    if (found.length === 0 && sawDynamic && firstSurface !== undefined && firstSurface.s !== null) {
        found.push({
            kind: 'undecidable',
            surface: firstSurface.s.id,
            evidence: `a write target is computed at runtime and this file carries the literal '${firstSurface.lit}'`,
        });
    }
    return found;
}

export function evaluate(root: string = REPO_ROOT, ledger?: GateLedger): Verdict {
    const { concerns, platforms } = loadManifest(root);
    const bySlot = slotsByConcern(platforms);
    const findings: Finding[] = [];
    let scanned = 0;
    let midSessionConcerns = 0;

    ledger?.plan(Object.keys(concerns));

    for (const [name, spec] of Object.entries(concerns)) {
        const slots = midSessionSlots(bySlot.get(name) ?? []);
        if (slots.length === 0) {
            ledger?.outOfScope(name, 'not_applicable_kind');
            continue;
        }
        midSessionConcerns += 1;

        const rel = typeof spec?.script === 'string' ? spec.script : null;
        if (rel === null) {
            ledger?.skip(name, 'manifest_absent');
            continue;
        }
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs)) {
            ledger?.skip(name, 'no_applicable_files');
            continue;
        }
        scanned += 1;

        const declaredReArm = typeof spec?.re_arm === 'string' ? spec.re_arm : null;
        if (declaredReArm !== null && RE_ARM_EVENTS.includes(declaredReArm)) {
            ledger?.skip(name, 'declared_exemption');
            continue;
        }

        const hits = classifyScript(fs.readFileSync(abs, 'utf-8'));
        for (const hit of hits) {
            findings.push({ concern: name, script: rel, slots, kind: hit.kind, surface: hit.surface, evidence: hit.evidence });
        }
        if (hits.length > 0) ledger?.fail(name, `${String(hits.length)} mid-session write(s) into a prefix-stable surface`);
        else ledger?.complete(name);
    }
    return { scanned, findings, midSessionConcerns };
}

// ---------------------------------------------------------------- self-test

function plant(dir: string, reArm: string | null, body: string): void {
    fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'scripts', 'fixture_hook.ts'), body);
    const arm = reArm === null ? '' : `\n    re_arm: ${reArm}`;
    fs.writeFileSync(
        path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'),
        `schema_version: 1\nconcerns:\n  fixture:\n    script: src/scripts/fixture_hook.ts${arm}\nplatforms:\n  claude:\n    post_tool_use:\n      - fixture\n`,
    );
}

const WRITES_SURFACE = `import * as fs from 'node:fs';\nfs.writeFileSync('dist/agent-src/rules/x.md', 'hi');\n`;
const WRITES_ELSEWHERE = `import * as fs from 'node:fs';\nfs.writeFileSync('agents/runtime/state/x.json', 'hi');\n`;
const DYNAMIC_WITH_SURFACE_LITERAL = `import * as fs from 'node:fs';\nconst root = 'dist/agent-src/rules';\nfs.writeFileSync(target, 'hi');\n`;
const DYNAMIC_NO_SURFACE = `import * as fs from 'node:fs';\nfs.writeFileSync(target, 'hi');\n`;
const READS_ONLY = `import * as fs from 'node:fs';\nfs.readFileSync('dist/agent-src/rules/x.md', 'utf-8');\n`;

function selfTestCases(): SelfTestCase[] {
    const mk = (name: string, expect: 'reject' | 'accept', reArm: string | null, body: string): SelfTestCase => ({
        name,
        expect,
        run: () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psm-'));
            try {
                plant(dir, reArm, body);
                return runGateCli(REPO_ROOT, 'src/scripts/check_prefix_stable_mutation.ts', ['--root', dir, '--quiet'], REPO_ROOT);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        },
    });
    return [
        mk('mid-session write to a declared surface, no re-arm → reject', 'reject', null, WRITES_SURFACE),
        mk('same write with re_arm: pre_compact → accept', 'accept', 'pre_compact', WRITES_SURFACE),
        mk('same write with re_arm: session_start → accept', 'accept', 'session_start', WRITES_SURFACE),
        mk('write outside every declared surface → accept', 'accept', null, WRITES_ELSEWHERE),
        mk('dynamic target + surface literal in file → reject (fail-closed)', 'reject', null, DYNAMIC_WITH_SURFACE_LITERAL),
        mk('dynamic target, no surface literal → accept (not claimed)', 'accept', null, DYNAMIC_NO_SURFACE),
        mk('reads a surface but never writes → accept', 'accept', null, READS_ONLY),
    ];
}

// ---------------------------------------------------------------------- CLI

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        return runSelfTest({ gate: 'check_prefix_stable_mutation', cases: selfTestCases(), minCases: 6, minRejectCases: 2 });
    }
    const quiet = argv.includes('--quiet');
    const json = argv.includes('--json');
    const ri = argv.indexOf('--root');
    const rootArg = ri !== -1 ? argv[ri + 1] : undefined;
    const root = rootArg !== undefined ? path.resolve(rootArg) : REPO_ROOT;

    const ledger = new GateLedger('check_prefix_stable_mutation');
    let verdict: Verdict;
    try {
        verdict = evaluate(root, ledger);
    } catch (err) {
        process.stderr.write(`❌  check_prefix_stable_mutation: ${(err as Error).message}\n`);
        return 2;
    }

    try {
        reportScanned({
            gate: 'check_prefix_stable_mutation',
            scanned: verdict.scanned,
            units: 'mid-session hook script(s)',
            roots: ['src/scripts/hook_manifest.yaml', ...prefixStableRoots()],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  check_prefix_stable_mutation: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    ledger.report();

    if (json) {
        process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
        return verdict.findings.length === 0 ? 0 : 1;
    }

    if (verdict.findings.length === 0) {
        if (!quiet) {
            process.stdout.write(
                `✅  no mid-session mutation of a prefix-stable surface ` +
                    `(${String(verdict.scanned)} script(s) across ${String(verdict.midSessionConcerns)} mid-session concern(s), ` +
                    `${String(PREFIX_STABLE_SURFACES.length)} declared surface(s)).\n`,
            );
        }
        return 0;
    }

    for (const f of verdict.findings) {
        process.stderr.write(
            `❌  ${f.concern} (${f.script}) fires on ${f.slots.join(', ')} and ${f.kind === 'literal' ? 'writes' : 'may write'} ` +
                `inside prefix-stable surface '${f.surface}':\n      ${f.evidence}\n`,
        );
    }
    process.stderr.write(
        `\n    A mid-session write to a prefix-stable surface invalidates the prompt cache for the\n` +
            `    rest of the session — the next call pays the cache-WRITE rate over the whole prefix.\n` +
            `    Either move the write to a re-arm boundary (${RE_ARM_EVENTS.join(' / ')}), or declare\n` +
            `    're_arm: <event>' on the concern in src/scripts/hook_manifest.yaml naming the boundary\n` +
            `    at which the rebuilt prefix is expected and paid for once.\n`,
    );
    return 1;
}

if (process.env['GATE_SELF_TEST_CHILD'] !== '1' || process.argv.includes('--root')) {
    if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
        process.exit(main());
    }
}
