/**
 * Tests for the gate-coverage meta-gate (`src/scripts/check_gate_coverage.ts`).
 *
 * The guard exists because three CI-wired gates were found scanning a tree
 * emptied by the ADR-051 migration, each exiting 0. These tests pin the three
 * design rules the guard is built on, plus its own anti-self-blindness contract.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { matchesGatePattern } from '../../src/scripts/_lib/gate_population.js';
import {
    type CanaryResult,
    type GateSpec,
    ci_invocation_problem,
    ci_invocations,
    ci_invocation_drift,
    classify,
    count_gate_scripts,
    ledgerOutcomeFor,
    enforced_manifest_ids,
    list_self_test_non_adopters,
    list_unhardened_gates,
    cross_check,
    load_manifest,
    parse_census,
    parse_scanned,
    run_canary,
} from '../../src/scripts/check_gate_coverage.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const spec = (over: Partial<GateSpec> = {}): GateSpec => ({
    id: 'some_gate',
    argv: [],
    min_scanned: 100,
    corpus: 'test corpus',
    status: 'enforced',
    ...over,
});

describe('parse_scanned — the machine-readable contract (design rule 1)', () => {
    it('reads the contract line wherever it sits in the output', () => {
        expect(parse_scanned('noise\nscanned: 429\nmore noise')).toBe(429);
        expect(parse_scanned('scanned: 0')).toBe(0);
    });

    it('returns null when the gate emitted no count — never guesses from prose', () => {
        // The whole point: a guard that infers counts from human output is the
        // fragile thing it replaces.
        expect(parse_scanned('✅  All 0 auto-rule descriptions ≤ 150 chars.')).toBeNull();
        expect(parse_scanned('Summary: 427 pass, 2 warn, 0 fail, 429 total')).toBeNull();
        expect(parse_scanned('')).toBeNull();
    });
});

describe('classify — baseline, not > 0 (design rule 3)', () => {
    it('a collapse from a large corpus to a few artefacts FAILS, though it is > 0', () => {
        // 428 → 3 is as broken as 428 → 0, and a zero-check cannot see it.
        const r = classify(spec({ min_scanned: 380 }), 3, false);
        expect(r.verdict).toBe('below_floor');
        expect(r.message).toMatch(/cannot certify/);
    });

    it('zero fails', () => {
        expect(classify(spec(), 0, false).verdict).toBe('below_floor');
    });

    it('at or above the floor passes', () => {
        expect(classify(spec({ min_scanned: 380 }), 380, false).verdict).toBe('ok');
        expect(classify(spec({ min_scanned: 380 }), 430, false).verdict).toBe('ok');
    });

    it('an enforced gate that reports nothing is a failure, not a pass', () => {
        expect(classify(spec(), null, false).verdict).toBe('silent');
    });

    it('a gate that cannot be executed fails rather than being skipped', () => {
        expect(classify(spec(), null, true).verdict).toBe('crashed');
    });
});

describe('classify — pending gates are reported, never silently skipped', () => {
    it('a pending gate never fails the build but is surfaced', () => {
        const r = classify(spec({ status: 'pending' }), null, false);
        expect(r.verdict).toBe('pending');
        expect(r.message).toMatch(/NOT enforced/);
    });

    it('a pending gate below its floor still does not fail — the floor is inert', () => {
        expect(classify(spec({ status: 'pending', min_scanned: 380 }), 0, false).verdict).toBe('pending');
    });
});

describe('load_manifest — the guard must not become the thing it catches', () => {
    const withManifest = (body: string, fn: (file: string) => void): void => {
        const dir = mkdtempSync(join(tmpdir(), 'gatecov-'));
        try {
            const f = join(dir, 'gate-coverage.yml');
            writeFileSync(f, body, 'utf8');
            fn(f);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };

    it('an EMPTY gate list is a hard error — a coverage guard over nothing is vacuous', () => {
        withManifest('gates: []\n', (f) => {
            expect(() => load_manifest(f)).toThrow(/vacuous/);
        });
    });

    it('a missing manifest is a hard error, not an empty pass', () => {
        expect(() => load_manifest(join(tmpdir(), 'gatecov-does-not-exist.yml'))).toThrow(/not found/);
    });

    it('rejects a non-integer floor', () => {
        withManifest('gates:\n  - id: g\n    min_scanned: "many"\n', (f) => {
            expect(() => load_manifest(f)).toThrow(/min_scanned/);
        });
    });

    it('rejects an unknown status rather than treating it as enforced', () => {
        withManifest('gates:\n  - id: g\n    min_scanned: 1\n    status: maybe\n', (f) => {
            expect(() => load_manifest(f)).toThrow(/status/);
        });
    });

    it('parses argv so CI-identical invocation is declarable (design rule 2)', () => {
        withManifest(
            'gates:\n  - id: g\n    argv: ["--all"]\n    min_scanned: 1\n    no_canary_reason: fixture\n',
            (f) => {
                expect(load_manifest(f)[0]?.argv).toEqual(['--all']);
            },
        );
    });

    it('refuses an enforced entry with neither a canary recipe nor a recorded reason', () => {
        // The silently-absent row is the failure this file exists to prevent,
        // one level up: 28 of 44 enforced entries have no negative control, and
        // a report that omits them reads as coverage. The reason is data, not
        // prose in a `note:` — four entries already carried the explanation
        // there and the inventory could not print any of them.
        withManifest('gates:\n  - id: g\n    min_scanned: 1\n', (f) => {
            expect(() => load_manifest(f)).toThrow(/no_canary_reason/);
        });
    });

    it('accepts an enforced entry carrying a canary recipe instead of a reason', () => {
        withManifest(
            'gates:\n  - id: g\n    min_scanned: 1\n    canary:\n      class: c\n      path: p.md\n      content: x\n',
            (f) => {
                expect(load_manifest(f)[0]?.no_canary_reason).toBeUndefined();
            },
        );
    });
});

describe('the real manifest', () => {
    it('loads, declares at least one ENFORCED gate, and every floor is a real bound', () => {
        const specs = load_manifest();
        expect(specs.length).toBeGreaterThan(0);
        expect(specs.some((s) => s.status === 'enforced')).toBe(true);
        for (const s of specs) {
            expect(s.corpus, `${s.id} must document what its count means`).not.toBe('');
        }
    });

    // ── Registry completeness (Phase 3.1) ──────────────────────────────────
    //
    // The manifest's own failure mode is OMISSION, not a wrong floor.
    // `check_site_links` reported green over a stale build for weeks and this
    // guard never flagged it — because the gate was never listed. A guard whose
    // coverage depends on someone remembering to register a gate repeats the
    // class it exists to catch. This test removes the remembering.
    it('every gate emitting the `scanned:` contract line is registered', () => {
        const scriptsDir = join(REPO_ROOT, 'src', 'scripts');
        // The literal a gate writes to satisfy design rule 1 — matched on the
        // EMISSION (a write of `scanned: ` followed by an interpolation), not on
        // the word appearing anywhere in the file.
        const EMITS = /(?:process\.(?:stdout|stderr)\.write|lines\.push)\(\s*`scanned: \$\{/;
        const emitters = readdirSync(scriptsDir)
            .filter(matchesGatePattern)
            .filter((f) => f !== 'check_gate_coverage.ts')
            .filter((f) => EMITS.test(readFileSync(join(scriptsDir, f), 'utf8')))
            .map((f) => f.replace(/\.ts$/, ''))
            .sort();

        const listed = new Set(load_manifest().map((s) => s.id));
        const missing = emitters.filter((id) => !listed.has(id));
        expect(
            missing,
            `these gates emit the coverage contract line but are not in ` +
                `src/config/gate-coverage.yml: ${missing.join(', ')}`,
        ).toEqual([]);
        // ...and the emitter set is non-empty, so the assertion above cannot pass
        // by scanning nothing — the same sin, one level up.
        expect(emitters.length).toBeGreaterThan(0);
    });

    it('states an honest denominator rather than implying full coverage', () => {
        const yml = readFileSync(join(REPO_ROOT, 'src', 'config', 'gate-coverage.yml'), 'utf8');
        expect(yml).toMatch(/HONEST DENOMINATOR/);
        // The population figure must be real: the header claims a number, and
        // the tree must still have roughly that many gate scripts.
        const claimed = /^# (\d+) `lint_\*`/m.exec(yml);
        expect(claimed, 'the header must state the gate-script population').not.toBeNull();
        const actual = count_gate_scripts();
        expect(Math.abs(Number((claimed as RegExpExecArray)[1]) - actual)).toBeLessThanOrEqual(15);
    });
});

// ── Mutation canary (Phase 7) ──────────────────────────────────────────────

describe('run_canary — plant, prove, revert', () => {
    const withRepo = (fn: (root: string) => void): void => {
        const dir = mkdtempSync(join(tmpdir(), 'canary-'));
        try {
            fn(dir);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };

    const withCanary = (over: Partial<GateSpec> = {}): GateSpec =>
        spec({
            id: 'echo_gate',
            canary: { class: 'test-class', path: 'nested/deep/plant.md', content: 'boom\n' },
            ...over,
        });

    it('a gate with NO recipe is reported UNPROVEN, never green', () => {
        // The failure this guards: an empty recipe set producing a clean ledger
        // and the claim "our gates work".
        const r = run_canary(spec());
        expect(r.verdict).toBe('no_recipe');
        expect(r.message).toMatch(/UNPROVEN/);
    });

    it('removes the plant — and the directories it created — whatever happens', () => {
        withRepo((root) => {
            const s = withCanary();
            // No `scripts-run` in the temp root, so the probe fails; the revert
            // still has to run. This is the crash path, deliberately.
            run_canary(s, root);
            expect(existsSync(join(root, 'nested/deep/plant.md'))).toBe(false);
            expect(existsSync(join(root, 'nested'))).toBe(false);
        });
    });

    it('REFUSES to plant over an existing file rather than overwriting it', () => {
        withRepo((root) => {
            writeFileSync(join(root, 'occupied.md'), 'real content\n', 'utf8');
            const s = withCanary({
                canary: { class: 'c', path: 'occupied.md', content: 'clobber\n' },
            });
            const r = run_canary(s, root);
            expect(r.verdict).toBe('crashed');
            expect(r.message).toMatch(/refusing to overwrite/);
            expect(readFileSync(join(root, 'occupied.md'), 'utf8')).toBe('real content\n');
        });
    });

    it('rejects a half-declared recipe at load time', () => {
        const dir = mkdtempSync(join(tmpdir(), 'gatecov-'));
        try {
            const f = join(dir, 'm.yml');
            writeFileSync(
                f,
                'gates:\n  - id: g\n    min_scanned: 1\n    canary:\n      class: c\n      path: p.md\n',
                'utf8',
            );
            // A recipe with no content would plant an empty file and the gate
            // would pass — a canary that certifies itself.
            expect(() => load_manifest(f)).toThrow(/canary needs class, path and content/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('rejects a canary path that escapes the repo', () => {
        const dir = mkdtempSync(join(tmpdir(), 'gatecov-'));
        try {
            const f = join(dir, 'm.yml');
            writeFileSync(
                f,
                'gates:\n  - id: g\n    min_scanned: 1\n    canary:\n      class: c\n' +
                    '      path: ../../etc/plant.md\n      content: x\n',
                'utf8',
            );
            expect(() => load_manifest(f)).toThrow(/repo-relative/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('the real manifest declares at least one recipe, and each names a class', () => {
        const withRecipe = load_manifest().filter((s) => s.canary !== undefined);
        expect(withRecipe.length).toBeGreaterThan(0);
        for (const s of withRecipe) {
            expect(s.canary?.class, `${s.id} recipe must name its defect class`).not.toBe('');
            expect(
                existsSync(join(REPO_ROOT, s.canary?.path ?? '')),
                `${s.id} canary path must NOT exist in a clean tree — a leftover plant means a previous run did not revert`,
            ).toBe(false);
        }
    });
});

describe('parse_census — column-position-agnostic', () => {
    const md = [
        '| Gate | Root | Kind | Units | Declared by |',
        '|---|---|---|---:|---|',
        '| `lint_alpha` | `src/a` | corpus | 111 | literal |',
        '| `lint_beta` | `src/b` | corpus | **19 violations** | resolver |',
        '| `lint_gamma` | `src/c` | corpus | not measured | literal |',
        '| `lint_delta` | `src/d` | corpus | 1,170 | resolver |',
    ].join('\n');

    it('reads gate → units regardless of where the columns sit', () => {
        const m = parse_census(md);
        expect(m.get('lint_alpha')).toBe(111);
        expect(m.get('lint_beta')).toBe(19);
        expect(m.get('lint_delta')).toBe(1170);
    });

    it('an unmeasured row is null, not zero — "unknown" is not "empty"', () => {
        expect(parse_census(md).get('lint_gamma')).toBeNull();
    });

    it('a row with no extractable root is NOT censused — three absences, not two', () => {
        // `undefined` (not censused), `null` (censused, read nothing) and a
        // number are three different states, and the disagreement check acts on
        // the first two in opposite ways: `undefined` is skipped, `null` is a
        // stale row. A gate that resolves its corpus dynamically — spawning
        // `git diff` or `npm pack` — has no static root to extract, so the
        // census prints `_(none extracted)_` and `**0**` for it. Reading that as
        // `null` reported every such gate as stale the moment its canary
        // correctly went red; reading it as 0 did the same. It is neither.
        const dyn = [
            '| Gate | Root | Kind | Units | Declared by |',
            '|---|---|---|---:|---|',
            '| `lint_dynamic` | _(none extracted)_ | absent | **0** | `—` |',
            '| `lint_real_zero` | `src/e` | corpus | 0 | literal |',
        ].join('\n');
        const m = parse_census(dyn);
        expect(m.has('lint_dynamic'), 'un-extractable must not be censused at all').toBe(false);
        // The counter-test: a genuine zero over a REAL root still reports 0, or
        // this change would have silenced the dead-scope signal it must keep.
        expect(m.get('lint_real_zero')).toBe(0);
    });

    it('a census with a different column order still parses', () => {
        const reordered = [
            '| Units | Gate | Status |',
            '|---:|---|---|',
            '| 42 | `lint_alpha` | repaired |',
        ].join('\n');
        expect(parse_census(reordered).get('lint_alpha')).toBe(42);
    });
});

describe('cross_check — the two artefacts must disagree loudly', () => {
    const res = (id: string, verdict: CanaryResult['verdict']): CanaryResult => ({
        id,
        verdict,
        class: 'c',
        exit_code: verdict === 'red' ? 1 : 0,
        message: '',
    });

    it('census says it reads a live corpus + canary stayed green = DEAD GATE', () => {
        const d = cross_check([res('g', 'green')], new Map([['g', 111]]));
        expect(d).toHaveLength(1);
        expect(d[0]?.kind).toBe('dead_gate');
    });

    it('canary went red but the census records nothing = STALE CENSUS', () => {
        const d = cross_check([res('g', 'red')], new Map([['g', null]]));
        expect(d[0]?.kind).toBe('census_stale');
        expect(cross_check([res('g', 'red')], new Map([['g', 0]]))[0]?.kind).toBe('census_stale');
    });

    it('agreement is silent', () => {
        expect(cross_check([res('g', 'red')], new Map([['g', 111]]))).toEqual([]);
    });

    it('a gate absent from the census produces no phantom disagreement', () => {
        expect(cross_check([res('g', 'green')], new Map())).toEqual([]);
    });
});

describe('classify — unavailable: prerequisite absent, not silence', () => {
    // A gate whose inputs do not exist locally (check_site_links needs a built site)
    // must not read as `silent`. Failing there would make the guard red for an
    // environmental reason, which teaches people to ignore it — worse than no gate.
    const spec = {
        id: 'check_site_links',
        argv: [],
        min_scanned: 20,
        corpus: 'built HTML pages',
        status: 'enforced' as const,
        unavailable_exit: 2,
    };

    it('the declared exit code yields unavailable, not silent', () => {
        const r = classify(spec, null, false, 2);
        expect(r.verdict).toBe('unavailable');
        expect(r.message).toMatch(/prerequisite absent/);
    });

    it('any OTHER exit code with no count is still silent', () => {
        // The carve-out is one specific code, not "non-zero" — a gate that crashes or
        // fails while emitting nothing is still a coverage defect.
        expect(classify(spec, null, false, 1).verdict).toBe('silent');
        expect(classify(spec, null, false, 0).verdict).toBe('silent');
    });

    it('the floor still applies when the gate DID run', () => {
        expect(classify(spec, 3, false, 0).verdict).toBe('below_floor');
        expect(classify(spec, 25, false, 0).verdict).toBe('ok');
    });

    it('a gate without unavailable_exit never gets the carve-out', () => {
        // Build the spec WITHOUT the key rather than setting it to undefined —
        // exactOptionalPropertyTypes distinguishes the two, and the loader omits the
        // key entirely when the manifest does not declare it.
        const { unavailable_exit: _omitted, ...strict } = spec;
        expect(classify(strict, null, false, 2).verdict).toBe('silent');
    });
});

describe('self-test ratchet — registered gates that cannot prove discrimination', () => {
    it('adoption is the import OR a reasoned exemption, nothing else', () => {
        const dir = mkdtempSync(join(tmpdir(), 'selftest-'));
        try {
            writeFileSync(
                join(dir, 'lint_adopts.ts'),
                "import { runSelfTest } from './_lib/gate_self_test.js';\n",
            );
            writeFileSync(join(dir, 'lint_exempt.ts'), '// self-test-exempt: pure formatter, no verdict\n');
            writeFileSync(join(dir, 'lint_bare.ts'), 'export function main() { return 0; }\n');
            // A marker with no reason is not an exemption — same discipline as
            // `// no-index:` and `// ledger-exempt:`.
            writeFileSync(join(dir, 'lint_bare_marker.ts'), '// self-test-exempt:\n');

            const ids = new Set(['lint_adopts', 'lint_exempt', 'lint_bare', 'lint_bare_marker']);
            expect(list_self_test_non_adopters(dir, ids)).toEqual(['lint_bare', 'lint_bare_marker']);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('a registered id with no readable script counts as a non-adopter', () => {
        // Fail toward exposure: a manifest row pointing at nothing cannot have
        // proven anything, and silently dropping it would let a deleted gate
        // lower the count.
        const dir = mkdtempSync(join(tmpdir(), 'selftest-missing-'));
        try {
            expect(list_self_test_non_adopters(dir, new Set(['lint_ghost']))).toEqual(['lint_ghost']);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('the population is the manifest, so padding it cannot game the count', () => {
        // Every id measured comes from `enforced_manifest_ids()`, i.e. rows that
        // are `enforced` AND carry a floor ≥ 1. Adding a row to move this number
        // means accepting a floor — the opposite of gaming.
        const ids = enforced_manifest_ids();
        const missing = list_self_test_non_adopters();
        expect(ids.size).toBeGreaterThan(0);
        expect(missing.length).toBeLessThanOrEqual(ids.size);
        for (const id of missing) expect(ids.has(id)).toBe(true);
    });

    it('the count is a NON-adopter count — it can rise, and the target is 0', () => {
        // The shape distinction this ratchet exists to honour: an adoption
        // percentage can never regress, so it grades the solution instead of the
        // problem (see report_hardening_ratchet's own comment in the same file).
        const dir = mkdtempSync(join(tmpdir(), 'selftest-rise-'));
        try {
            writeFileSync(join(dir, 'lint_a.ts'), "import './_lib/gate_self_test.js';\n");
            expect(list_self_test_non_adopters(dir, new Set(['lint_a']))).toEqual([]);
            // A NEW registered gate with no self-test raises the count.
            writeFileSync(join(dir, 'lint_b.ts'), 'export function main() { return 0; }\n');
            expect(list_self_test_non_adopters(dir, new Set(['lint_a', 'lint_b']))).toEqual(['lint_b']);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('vulnerability ratchet — unhardened gate population', () => {
    it('classifies a gate as hardened only via a scope assertion or a scanned line', () => {
        const dir = mkdtempSync(join(tmpdir(), 'unhardened-'));
        try {
            // Population members, one per hardening route plus one with neither.
            writeFileSync(join(dir, 'check_asserts.ts'), 'assertScanned({ scanned: n });\n');
            writeFileSync(join(dir, 'check_watchlist.ts'), 'assertWatchlistResolves({ candidates });\n');
            writeFileSync(join(dir, 'check_reports.ts'), 'reportScanned({ scanned: n });\n');
            writeFileSync(join(dir, 'lint_emits.ts'), 'process.stdout.write(`scanned: ${String(n)}\\n`);\n');
            writeFileSync(join(dir, 'audit_bare.ts'), 'export function main() { return 0; }\n');
            // Not in the population: wrong prefix, and a declaration file.
            writeFileSync(join(dir, 'helper_bare.ts'), 'export const x = 1;\n');
            writeFileSync(join(dir, 'check_types.d.ts'), 'export declare const y: number;\n');

            expect(list_unhardened_gates(dir, new Set(['lint_emits']))).toEqual(['audit_bare']);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('an emitted count hardens nothing when no floor enforces it', () => {
        // The tightening measured on 2026-08-04: a `scanned:` line in a gate the
        // coverage guard never runs is decoration. It can print `scanned: 0` out
        // of a deleted root, exit 0, and be read by nobody — so adding one was
        // simultaneously the cheapest route to a green ratchet and the route that
        // changes nothing. Registration is what turns the line into a guard.
        const dir = mkdtempSync(join(tmpdir(), 'unregistered-emit-'));
        try {
            writeFileSync(join(dir, 'lint_emits.ts'), 'process.stdout.write(`scanned: ${String(n)}\\n`);\n');
            expect(list_unhardened_gates(dir, new Set())).toEqual(['lint_emits']);
            expect(list_unhardened_gates(dir, new Set(['lint_emits']))).toEqual([]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('only enforced manifest entries with a real floor can harden an emitter', () => {
        // A `pending` entry, or `min_scanned: 0`, reads the line without being
        // able to fail on it — hardening on either would be a floor of nothing.
        const ids = enforced_manifest_ids();
        expect(ids.size).toBeGreaterThan(0);
        for (const spec of load_manifest()) {
            if (spec.status !== 'enforced' || spec.min_scanned < 1) {
                expect(ids.has(spec.id)).toBe(false);
            }
        }
    });

    it('the coverage guard is inside its own definition of hardened', () => {
        // It emits `scanned:` but is not in its own manifest, so before the
        // 2026-08-04 conversion it was the one gate exempt from the rule it
        // enforces. Grandfathering it would have been the exact self-exemption
        // this file exists to refuse.
        expect(list_unhardened_gates()).not.toContain('check_gate_coverage');
    });

    it('the whole population is hardened — the count is 0', () => {
        // Reached 2026-08-05 (189 → 0). Asserted as an exact 0 rather than a
        // falling number: with the baseline entry deleted (next test) the ratchet
        // has no floor left to sit on, so any new gate written without a scope
        // assertion must red here immediately.
        const unhardened = list_unhardened_gates();
        expect(unhardened).toEqual([]);
        expect(count_gate_scripts()).toBeGreaterThan(0);
    });

    it('the baseline entry is DELETED, not zeroed-and-kept', () => {
        // The roadmap's closure criterion, pinned. A `count: 0` entry left in
        // place would still be a baseline: `checkRatchet` compares against it and
        // the 56-day non-stagnation clause would start failing a number that
        // cannot drop further. With NO entry it returns `unbaselined` with
        // `ok = (actual === 0)` — zero becomes mandatory instead of a floor.
        // Re-adding an entry here is how this gate gets quietly disarmed, so the
        // absence is a test, not an accident.
        const raw = JSON.parse(
            readFileSync(join(REPO_ROOT, 'src/config/gate-violation-baselines.json'), 'utf8'),
        ) as { gates: Record<string, { count: number }> };
        expect(raw.gates['gate-hardening:unhardened-scan-scope']).toBeUndefined();
    });
});

describe('ledgerOutcomeFor — inspected vs not inspected', () => {
    // The three cases this pins were all mis-mappings in the first version:
    // `estate_invalid` and `crashed` were recorded as `fail`, which counts into
    // the ledger's inspected total and so over-reported coverage on a target
    // that was never read; and `unavailable` was mapped to a credential reason
    // when the only gate it applies to is unavailable for an unbuilt artefact.
    it('never counts an unread target as inspected', () => {
        for (const v of ['crashed', 'estate_invalid', 'pending', 'unavailable'] as const) {
            const outcome = ledgerOutcomeFor(v);
            expect(outcome, `${v} must be a skip`).not.toBe('complete');
            expect(outcome, `${v} must be a skip`).not.toBe('fail');
        }
    });

    it('counts a measured violation as failed, not skipped', () => {
        expect(ledgerOutcomeFor('silent')).toBe('fail');
        expect(ledgerOutcomeFor('below_floor')).toBe('fail');
    });

    it('counts a clean measured gate as completed', () => {
        expect(ledgerOutcomeFor('ok')).toBe('complete');
    });

    it('does not blame a missing credential for an unbuilt artefact', () => {
        // The skip sentence is the audit surface: a reader seeing this must not
        // be sent hunting for an unset token.
        expect(ledgerOutcomeFor('unavailable')).not.toBe('missing_credentials');
    });

    it('does not blame a dead scan root for a gate that threw', () => {
        // Same audit-sentence class as the credential case above: `crashed`
        // means the check could not execute, and its root is usually fine.
        expect(ledgerOutcomeFor('crashed')).toBe('check_did_not_run');
        expect(ledgerOutcomeFor('estate_invalid')).toBe('dead_scan_root');
    });

    it('refuses an unclassified verdict instead of counting it as inspected', () => {
        // The `default: return 'complete'` this replaced would have counted a
        // newly added Verdict member as READ, with the switch and every test
        // above still green. The throw is the point.
        expect(() => ledgerOutcomeFor('timeout' as never)).toThrow(/unhandled verdict/);
    });
});


/**
 * Rule 2 of the manifest — CI-IDENTICAL INVOCATION — used to be enforced by
 * nobody. The guard ran whatever `argv` said, so a row could keep reporting a
 * healthy floor for a gate whose CI step had been deleted. That is not
 * hypothetical: check_finding_dispositions had one caller, on a `release/*` head
 * branch deleted after every merge, and two releases shipped with no findings
 * ledger while this manifest said nothing.
 */
describe('ci_invocation — a row pinned to a workflow that stopped calling the gate', () => {
    const WORKFLOW = [
        'jobs:',
        '  x:',
        '    steps:',
        '      - name: bare call',
        '        run: ./scripts-run src/scripts/some_gate',
        '      - name: call with args',
        '        run: |',
        '          ./scripts-run src/scripts/other_gate \\',
        '            --release "$v" --pr 7',
    ].join('\n');

    it('reads a bare invocation as an empty argument list', () => {
        expect(ci_invocations(WORKFLOW, 'some_gate')).toEqual([[]]);
    });

    it('folds a line continuation so a split call is still one invocation', () => {
        expect(ci_invocations(WORKFLOW, 'other_gate')).toEqual([['--release', '"$v"', '--pr', '7']]);
    });

    it('does not match a gate whose name is a prefix of another', () => {
        expect(ci_invocations(WORKFLOW, 'some')).toEqual([]);
    });

    it('accepts a row whose argv the workflow reproduces', () => {
        expect(ci_invocation_problem(WORKFLOW, 'some_gate', [])).toBeNull();
    });

    it('rejects a row whose argv the workflow does not reproduce', () => {
        expect(ci_invocation_problem(WORKFLOW, 'some_gate', ['--all'])).toMatch(/matches no invocation/u);
    });

    it('rejects a row whose workflow no longer calls the gate at all', () => {
        expect(ci_invocation_problem(WORKFLOW, 'deleted_gate', [])).toMatch(/does not call this gate/u);
    });

    it('is silent for every row that pins no workflow — the field is opt-in', () => {
        const spec = { id: 'some_gate', argv: [], min_scanned: 1, corpus: 'x', status: 'enforced' } as GateSpec;
        expect(ci_invocation_drift([spec])).toEqual([]);
    });

    it('reports a pinned workflow that does not exist rather than passing over it', () => {
        const spec = {
            id: 'some_gate',
            argv: [],
            min_scanned: 1,
            corpus: 'x',
            status: 'enforced',
            ci_invocation: '.github/workflows/no-such-file.yml',
        } as GateSpec;
        expect(ci_invocation_drift([spec])).toHaveLength(1);
    });

    it('the shipped manifest has no drift', () => {
        expect(ci_invocation_drift(load_manifest())).toEqual([]);
    });
});
