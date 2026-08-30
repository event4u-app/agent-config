#!/usr/bin/env tsx
/**
 * check_pack_size — enforce the published-tarball payload budget
 * (road-to-zero-ceremony-install Phase 4).
 *
 * Two metrics, both ungated before this script existed:
 *   1. COMPRESSED tarball size — absolute max, plus the >regression_pct creep
 *      rule (fails even under the absolute budget, so slow rot cannot hide
 *      under a generous cap).
 *   2. PER-SKILL share of the skills subtree — no single skill may silently
 *      reclaim space freed elsewhere. Named exceptions carry a reason.
 *
 * The UNPACKED size is deliberately NOT gated here — and since 2026-08-04 not
 * anywhere: the former `evaluator-budgets.unpacked_size_mb` key was removed by
 * maintainer decision (see `removed_2026_08_04` in evaluator-budgets.json);
 * the evaluator umbrella still measures it as evidence.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_pack_size [--json]
 *   ./scripts-run src/scripts/check_pack_size --pack-json <file>   # test/offline
 *
 * Exit codes: 0 green · 1 over budget · 2 misuse / unreadable input.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { runSelfTest } from './_lib/gate_self_test.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'src', 'config', 'pack-size-budget.json');
const SKILL_PREFIX = 'dist/agent-src/skills/';

export interface PackFile {
    path: string;
    size: number;
}

export interface PackResult {
    size: number;
    unpackedSize: number;
    files: PackFile[];
}

export interface PackSizeBudget {
    regression_pct: number;
    budgets: Record<string, { max: number; last_measured: number; method: string }>;
    per_skill_share: {
        max_pct: number;
        basis: string;
        rationale: string;
        exceptions: Record<string, { max_pct: number; measured_pct: number; reason: string }>;
    };
}

/**
 * Parse `npm pack --json` stdout. npm runs the `prepare` lifecycle script even
 * under `--ignore-scripts` on some versions, and this repo's `prepare` prints a
 * banner — straight into the stream we parse. Slice from a `[` so a lifecycle
 * banner is tolerated instead of becoming a SyntaxError.
 *
 * Not the FIRST `[`: npm echoes the lifecycle command line, and this repo's own
 * `prepare` is `[ -d .git ] && bash src/scripts/install-hooks.sh || true` — its
 * `[` precedes the payload's. Try each candidate offset in order and keep the
 * first that actually parses (road-to-gates-that-can-fail Phase 6.2).
 */
export function parsePackJson(stdout: string): PackResult {
    let parsed: PackResult[] | null = null;
    for (let i = stdout.indexOf('['); i >= 0; i = stdout.indexOf('[', i + 1)) {
        try {
            parsed = JSON.parse(stdout.slice(i)) as PackResult[];
            break;
        } catch {
            // Not the payload — a banner bracket. Keep scanning.
        }
    }
    // No candidate parsed: reproduce the original SyntaxError from the raw text.
    parsed ??= JSON.parse(stdout) as PackResult[];
    const first = parsed[0];
    if (first === undefined) throw new Error('npm pack --json returned an empty array');
    return first;
}

/** Bytes per skill under `dist/agent-src/skills/`, plus the subtree total. */
export function skillBytes(files: readonly PackFile[]): { perSkill: Record<string, number>; total: number } {
    const perSkill: Record<string, number> = {};
    let total = 0;
    for (const file of files) {
        if (!file.path.startsWith(SKILL_PREFIX)) continue;
        const name = file.path.slice(SKILL_PREFIX.length).split('/')[0];
        if (name === undefined || name === '') continue;
        perSkill[name] = (perSkill[name] ?? 0) + file.size;
        total += file.size;
    }
    return { perSkill, total };
}

/** Every violation, as human-readable lines. Empty array means green. */
/**
 * Content classes the published payload is checked for.
 *
 * The gap this closes: before it, the tarball was measured by SIZE and by build
 * correctness, and by nothing that read what the files ARE. A payload can be
 * comfortably under budget and still ship compiled tests, an IDE directory, or
 * a credential-shaped file.
 *
 * `limit: 0` is a hard class — nothing of that shape may ship. A positive limit
 * is a RATCHET: the number was measured, not chosen, and it may only walk down.
 * The distinction is in `measured_in`, which every entry carries, because the
 * same `npm pack` reports a fifth of the source maps in an unbuilt worktree as
 * in a built one. A threshold with no stated tree reads as drift the first time
 * someone runs it from a fresh checkout.
 */
interface ContentClass {
    id: string;
    /** Matches a payload path. */
    match: (p: string) => boolean;
    /** 0 = must not ship at all. > 0 = shrink-only ratchet. */
    limit: number;
    /** Which tree the limit was measured in, and when. */
    measured_in: string;
    /**
     * True when the class only exists in a BUILT tree.
     *
     * This is the difference between a check and a false pass. `npm pack
     * --dry-run --ignore-scripts` on a clean checkout — which is the condition
     * `pack-size-budget.json` declares for its own numbers — produces no
     * `dist/cli/**` at all, so a source-map count of 22 sails under a limit of
     * 120 while measuring a fifth of the payload. Reported NOT MEASURABLE
     * instead, on the same principle as the dead-scope assertion above: a check
     * that could not run is not a clean bill.
     */
    requires_build: boolean;
    why: string;
}

/**
 * Was this payload produced from a built tree?
 *
 * Keyed on the payload itself rather than on the filesystem, so it describes
 * the thing being judged instead of the machine judging it.
 */
function payloadIsBuilt(files: readonly PackFile[]): boolean {
    return files.some((f) => f.path.startsWith('dist/cli/'));
}

const CONTENT_CLASSES: readonly ContentClass[] = [
    {
        id: 'compiled-test-artefact',
        requires_build: true,
        match: (p) => /\.(test|spec)\.(js|js\.map|d\.ts)$/.test(p),
        limit: 0,
        measured_in: 'built main checkout, 2026-08-22: 8 `.test.js` + 8 `.test.js.map` were shipping before the `files[]` negations landed',
        why: "a compiled test's output has no consumer-facing purpose; council 2026-08-22 decision (b') strips BOTH the JS and its map, because stripping only the maps left the compiled tests themselves in the tarball",
    },
    {
        id: 'credential-shaped',
        requires_build: false,
        match: (p) => /(^|\/)\.env(\.|$)|\.pem$|(^|\/)id_(rsa|ed25519)$|\.p12$|\.pfx$/.test(p),
        limit: 0,
        measured_in: 'built main checkout, 2026-08-22: 0 present',
        why: 'a clean class with no check is indistinguishable from a class nobody looked at — and this one is worth a canary precisely because it is empty today',
    },
    {
        id: 'ide-metadata',
        requires_build: false,
        match: (p) => /(^|\/)\.(idea|vscode)\//.test(p),
        limit: 0,
        measured_in: 'built main checkout, 2026-08-22: 0 present',
        why: 'same reason as the credential class: empty and unchecked is not the same as empty and verified',
    },
    {
        id: 'source-map',
        requires_build: true,
        match: (p) => p.endsWith('.js.map'),
        limit: 120,
        measured_in: 'built worktree, 2026-08-22, AFTER the compiled-test negations: 120 product maps (128 total minus 8 test maps)',
        why: "a product source map is a consumer debugging affordance — proper line mapping and stepping over shipped JS — so council 2026-08-22 kept the 119/120 product maps and refused a blanket zero. Recorded as a PROVISIONAL measured ratchet, not an architectural constant: nothing here establishes that any consumer debugs the shipped JS, and nothing establishes they do not",
    },
];

/**
 * Count each content class in the payload and report over-limit classes.
 *
 * Returns one error string per violating class, with the offending paths — the
 * count alone tells a reader a rule broke and not which file broke it.
 */
export function classifyPayload(files: readonly PackFile[]): string[] {
    const out: string[] = [];
    const built = payloadIsBuilt(files);
    for (const c of CONTENT_CLASSES) {
        if (c.requires_build && !built) continue;
        const hits = files.filter((f) => c.match(f.path)).map((f) => f.path);
        if (hits.length <= c.limit) continue;
        const shown = hits.slice(0, 8);
        out.push(
            `content class \`${c.id}\`: ${String(hits.length)} entr${hits.length === 1 ? 'y' : 'ies'} ` +
                `exceeds its limit of ${String(c.limit)} (measured in: ${c.measured_in}) — ` +
                `${shown.join(', ')}${hits.length > shown.length ? `, +${String(hits.length - shown.length)} more` : ''}. ` +
                `Why this class is checked: ${c.why}`,
        );
    }
    return out;
}

/** Per-class counts, for the green-path report. */
export function payloadClassCounts(
    files: readonly PackFile[],
): Array<{ id: string; count: number; limit: number; measurable: boolean }> {
    const built = payloadIsBuilt(files);
    return CONTENT_CLASSES.map((c) => ({
        id: c.id,
        count: files.filter((f) => c.match(f.path)).length,
        limit: c.limit,
        measurable: built || !c.requires_build,
    }));
}

/**
 * The recorded BUILT-surface figure, if the budget file carries one.
 *
 * Read by key SHAPE (`built_surface_measurement_<date>`) rather than by the one
 * dated key that exists today, so re-measuring the built surface is an added
 * record rather than an edit to this function. The newest key wins.
 */
export function recordedBuiltPackedMb(budget: PackSizeBudget): number | null {
    const keys = Object.keys(budget)
        .filter((k) => /^built_surface_measurement_/.test(k))
        .sort();
    const newest = keys[keys.length - 1];
    if (newest === undefined) return null;
    const block = (budget as unknown as Record<string, unknown>)[newest];
    if (block === null || typeof block !== 'object') return null;
    const built = (block as { built?: unknown }).built;
    if (built === null || typeof built !== 'object') return null;
    const value = (built as { packed_mb?: unknown }).packed_mb;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function evaluate(budget: PackSizeBudget, pack: PackResult): string[] {
    const errors: string[] = [];

    const packedMb = pack.size / 1e6;
    const entry = budget.budgets['packed_size_mb'];
    const built = payloadIsBuilt(pack.files);
    const pct = budget.regression_pct;
    if (entry === undefined) {
        errors.push('packed_size_mb: missing from the budget file — gate would pass vacuously');
    } else if (built) {
        // A BUILT payload is not the surface `max` describes, and comparing
        // them is the category error `pack-size-budget.json` warns about in its
        // own `measurement_conditions`: every cap in that file, `max: 9.1`
        // included, was measured with `--ignore-scripts` on a tree with no
        // `dist/cli/**`. The built surface it records separately is ~2 MB
        // larger *by construction*, so a job that happens to build first turns
        // a green branch red for a reason that has nothing to do with its diff.
        // Measured 2026-08-30: main 8.985 (2715 entries, unbuilt) against a
        // branch adding six source files at 9.922 (2827 entries) — the 112-file
        // difference is `dist/cli` + `dist/cli-delegate`, not the diff.
        //
        // So the built payload is judged against the recorded BUILT figure,
        // with the same creep percentage. That keeps teeth on the surface a
        // consumer installs instead of pretending the unbuilt cap covers it.
        const baseline = recordedBuiltPackedMb(budget);
        if (baseline === null) {
            errors.push(
                `packed_size_mb: measured ${packedMb.toFixed(3)} on a BUILT payload, and the budget `
                    + 'file records no built-surface measurement to compare it against — the unbuilt '
                    + 'cap does not describe this tree. Record one, or pack with --ignore-scripts.',
            );
        } else {
            const ceiling = baseline * (1 + pct / 100);
            if (packedMb > ceiling) {
                errors.push(
                    `packed_size_mb (BUILT surface): measured ${packedMb.toFixed(3)} regressed `
                        + `>${String(pct)}% vs the recorded built figure ${String(baseline)} `
                        + `(ceiling ${ceiling.toFixed(3)})`,
                );
            }
        }
    } else if (packedMb > entry.max) {
        errors.push(`packed_size_mb: measured ${packedMb.toFixed(3)} exceeds budget ${entry.max}`);
    } else {
        const ceiling = entry.last_measured * (1 + pct / 100);
        if (entry.last_measured > 0 && packedMb > ceiling) {
            errors.push(
                `packed_size_mb: measured ${packedMb.toFixed(3)} regressed >${pct}% vs ` +
                    `last_measured ${entry.last_measured} (ceiling ${ceiling.toFixed(3)}) — ` +
                    'fails even under the absolute budget',
            );
        }
    }

    const { perSkill, total } = skillBytes(pack.files);
    if (total === 0) {
        errors.push(`per_skill_share: no files under ${SKILL_PREFIX} — gate would pass vacuously`);
        return errors;
    }
    const { max_pct: defaultMax, exceptions } = budget.per_skill_share;
    for (const [name, bytes] of Object.entries(perSkill)) {
        const share = (bytes / total) * 100;
        const exception = exceptions[name];
        const cap = exception?.max_pct ?? defaultMax;
        if (share > cap) {
            errors.push(
                exception === undefined
                    ? `per_skill_share: ${name} is ${share.toFixed(2)}% of the skills payload, over the ${cap}% cap — ` +
                      'shrink it, or add a named exception with a reason'
                    : `per_skill_share: ${name} is ${share.toFixed(2)}%, over its own exception cap of ${cap}% — ` +
                      'the exception is not a blank cheque; shrink it or raise the cap with a reason',
            );
        }
    }
    for (const name of Object.keys(exceptions)) {
        if (!(name in perSkill)) {
            errors.push(`per_skill_share: exception for '${name}' is stale — no such skill ships`);
        }
    }
    return errors;
}

function readPack(argv: readonly string[]): PackResult {
    const idx = argv.indexOf('--pack-json');
    if (idx >= 0) {
        const file = argv[idx + 1];
        if (file === undefined) throw new Error('--pack-json needs a path');
        return parsePackJson(fs.readFileSync(file, 'utf-8'));
    }
    const stdout = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--silent'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parsePackJson(stdout);
}

/**
 * Per-class discrimination, proven rather than asserted.
 *
 * WHY THIS EXISTS AND THE CANARY DOES NOT COVER IT. `gate-coverage.yml` carries
 * `canary?: CanarySpec` — exactly ONE recipe per gate id, not a list (see
 * `check_gate_coverage.ts`'s entry shape). The roadmap step behind this asked
 * for "one canary per class", which the register cannot express. Two of the four
 * classes cannot be planted through it at all: `compiled-test-artefact` is
 * excluded from the payload by the `files[]` negations that fixed it, so a plant
 * never ships and never reds, and `source-map` needs 121 files in a BUILT tree.
 *
 * So the register gets the one canary it can hold — the credential-shaped plant,
 * chosen because that class is empty today and an empty unchecked class is
 * indistinguishable from one nobody looked at — and every class is proven red
 * here, over a synthetic payload, deterministically and with no pack run.
 *
 * A test file was the alternative and is weaker: the non-adopter ratchet in
 * `check_gate_coverage` requires a NEW registered gate to carry a `--self-test`
 * or an exemption, and a self-test drives the gate's own decision function
 * rather than a copy of it.
 */
function packFiles(...paths: readonly string[]): PackFile[] {
    return paths.map((path) => ({ path, size: 1 }));
}

/** A payload that looks built, so `requires_build` classes do not abstain. */
function builtPayload(...paths: readonly string[]): PackFile[] {
    return packFiles('dist/cli/agent-config.js', ...paths);
}

function selfTest(): number {
    // NOT under `dist/cli/` — that prefix is exactly what `payloadIsBuilt`
    // keys on, so maps placed there would make an "unbuilt" fixture built and
    // the abstain case would test nothing. Found by the case failing, which is
    // the self-test doing its job on its own fixtures.
    const maps = (n: number): string[] =>
        Array.from({ length: n }, (_, i) => `dist/hooks/chunk-${String(i)}.js.map`);
    return runSelfTest({
        gate: 'check_pack_size',
        minCases: 9,
        minRejectCases: 5,
        cases: [
            {
                name: 'credential-shaped: a .pem in the payload is refused',
                expect: 'reject',
                run: () => (classifyPayload(packFiles('src/scripts/x.pem')).length > 0 ? 1 : 0),
            },
            {
                name: 'credential-shaped: a dotted .env form is refused',
                expect: 'reject',
                run: () => (classifyPayload(packFiles('src/config/.env.production')).length > 0 ? 1 : 0),
            },
            {
                name: 'ide-metadata: a .vscode entry is refused',
                expect: 'reject',
                run: () => (classifyPayload(packFiles('src/scripts/.vscode/settings.json')).length > 0 ? 1 : 0),
            },
            {
                name: 'compiled-test-artefact: a shipped .test.js is refused',
                expect: 'reject',
                run: () => (classifyPayload(builtPayload('dist/cli/a.test.js')).length > 0 ? 1 : 0),
            },
            {
                name: 'source-map: one over the measured ratchet is refused',
                expect: 'reject',
                run: () => (classifyPayload(builtPayload(...maps(121))).length > 0 ? 1 : 0),
            },
            {
                name: 'source-map: the ratchet boundary itself passes',
                expect: 'accept',
                run: () => (classifyPayload(builtPayload(...maps(120))).length > 0 ? 1 : 0),
            },
            {
                name: 'a plain payload passes — the classes are not firing on everything',
                expect: 'accept',
                run: () => (classifyPayload(packFiles('src/scripts/x.ts', 'README.md')).length > 0 ? 1 : 0),
            },
            {
                // The false pass 1.2 closed. An unbuilt payload carries a fifth
                // of the source maps, so a build-gated class must ABSTAIN there
                // rather than report clean — and must not report a failure
                // either, or every clean-checkout run would red.
                name: 'unbuilt payload: build-gated classes abstain, not pass and not fail',
                expect: 'accept',
                run: () => (classifyPayload(packFiles(...maps(121))).length > 0 ? 1 : 0),
            },
            {
                name: 'unbuilt payload: a build-INDEPENDENT class still fires',
                expect: 'reject',
                run: () => (classifyPayload(packFiles('src/scripts/id_rsa')).length > 0 ? 1 : 0),
            },
        ],
    });
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    let budget: PackSizeBudget;
    let pack: PackResult;
    try {
        budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf-8')) as PackSizeBudget;
    } catch (err) {
        process.stderr.write(`❌  pack size: cannot read ${BUDGET_PATH}: ${String(err)}\n`);
        return 2;
    }
    try {
        pack = readPack(argv);
    } catch (err) {
        process.stderr.write(`❌  pack size: npm pack failed: ${String(err)}\n`);
        return 2;
    }
    // The pack manifest IS the corpus. `evaluate` refuses a vacuous per-skill
    // share, but the packed-size arm has no such floor: an empty payload — a
    // botched `files[]`, a pack that resolved nothing — measures 0 MB and sits
    // comfortably under every budget.
    try {
        assertScanned({
            gate: 'check_pack_size',
            scanned: pack.files.length,
            units: 'packed file(s)',
            roots: ['npm pack --dry-run payload (package.json files[])'],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            // 2, not 1: the documented meaning of 1 is "over budget", and an
            // empty manifest is unreadable input, not a budget violation.
            process.stderr.write(`❌  pack size: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    // The coverage register requires an enforced gate to report what it
    // inspected, and it is the same reason `assertScanned` runs above: a verdict
    // with no denominator cannot be told apart from a verdict over nothing.
    // Printed on EVERY path, including the failing one, so a reader of a red run
    // still knows the population it was red over.
    process.stdout.write(`scanned: ${String(pack.files.length)}\n`);

    const errors = [...evaluate(budget, pack), ...classifyPayload(pack.files)];
    const { perSkill, total } = skillBytes(pack.files);
    if (argv.includes('--json')) {
        process.stdout.write(
            `${JSON.stringify({ packed_mb: pack.size / 1e6, skills_total_bytes: total, skills: Object.keys(perSkill).length, errors }, null, 2)}\n`,
        );
        return errors.length > 0 ? 1 : 0;
    }
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  pack size: ${e}\n`);
        return 1;
    }
    process.stdout.write(
        // The SURFACE is named on the green path too. A figure with no surface
        // label is how two numbers for one lever start circulating, which is
        // the confusion this budget file opens by warning about.
        `✅  pack size within budget (${payloadIsBuilt(pack.files) ? 'BUILT surface, vs the recorded built figure' : 'UNBUILT surface, vs max'}) — ${(pack.size / 1e6).toFixed(3)} MB packed, ` +
            `${Object.keys(perSkill).length} skills, largest share ` +
            `${Math.max(...Object.values(perSkill).map((b) => (b / total) * 100)).toFixed(2)}%\n`,
    );
    // Printed on the GREEN path on purpose. A class that is clean and silent is
    // indistinguishable from a class nobody checks, which is the whole reason
    // two of these four are limit-0 over an empty set today.
    for (const c of payloadClassCounts(pack.files)) {
        const verdict = c.measurable
            ? `${String(c.count)} / ${c.limit === 0 ? 'must be 0' : `${String(c.limit)} max`}`
            : 'NOT MEASURABLE — this payload has no dist/cli/**, so the tree is unbuilt and the class is out of view';
        process.stdout.write(`    content class ${c.id}: ${verdict}\n`);
    }
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
