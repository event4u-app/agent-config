/**
 * Tests for `src/scripts/lint_deterministic_time.ts` — the ratchet that keeps a
 * gate's verdict a function of the tree rather than of the hour it ran.
 *
 * RED BEFORE GREEN, and this one is recorded because the gate was written before
 * the fix it demands. Run against the unmodified tree on 2026-08-23 the gate
 * exited **1** with **18 findings across 17 files** — `check_always_budget.ts:438`,
 * `check_augmentignore.ts:79`, `check_beta_review_markers.ts:188`,
 * `check_corpus_staleness.ts:129`, `check_council_pin_staleness.ts:237`,
 * `check_gate_coverage.ts:982`, `check_knowledge_cards.ts:488`,
 * `check_knowledge_pages.ts:{75,148}`, `check_memory.ts:279`,
 * `check_proposal.ts:367`, `check_reach_staleness.ts:111`,
 * `check_release_adjacent_health.ts:122`, `check_source_size_budget.ts:219`,
 * `check_trigger_evals.ts:102`, `lint_budget_ownership.ts:157`,
 * `lint_one_off_age.ts:62`, `lint_symptom_intake.ts:135`. The same command exits
 * 0 now, which is what the first case below pins.
 *
 * THE SCANNER'S TWO DEFECTS WERE FOUND THAT WAY, not by review, and both are
 * pinned below because each one silently changed the finding set:
 *   - blanking string bodies to SPACES collapsed `new Date("…")` into
 *     `new Date()` and produced a false positive on
 *     `check_knowledge_pages.ts:103`;
 *   - blanking a template literal wholesale HID a real finding at
 *     `check_gate_coverage.ts:982`, where the read sits inside `${…}`.
 *
 * SABOTAGE PROBE, run 2026-08-23 before this file was trusted, on the fixture
 * cases rather than on the real tree (the real tree is clean now, so it cannot
 * demonstrate sensitivity). Observed, not asserted:
 *   - emptying `PATTERNS` → **5 of 13 red** (every detection case plus the
 *     bare-marker and template-substitution cases): with no pattern the gate
 *     certifies a wall-clock read as clean;
 *   - making `stripNonCode` the identity function → **2 of 13 red**, and the
 *     pair is the point: the real-tree case AND the comment/string case, i.e.
 *     the gate refuses its own source, which is the self-refusal failure the
 *     stripper exists to avoid.
 * Restoring each gives 13/13 and `git diff --stat` over the gate path is empty.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    SCAN_DIR,
    check,
    gateScripts,
    main,
    scanSource,
    stripNonCode,
} from '../../src/scripts/lint_deterministic_time.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A throwaway repo root holding only the named gate scripts. */
function fixtureRoot(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(join(os.tmpdir(), 'dt-test-'));
    fs.mkdirSync(join(dir, SCAN_DIR), { recursive: true });
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(join(dir, SCAN_DIR, name), body);
    }
    return dir;
}

// Built by concatenation so this test file's own source does not carry the
// literals — `tests/` is outside the gate's scan scope, but the repo-wide grep
// in the roadmap's AC-1 is not, and a fixture is not worth a false hit.
const RAW_NOW = 'const t = ' + 'Date' + '.now();\n';
const RAW_NEW = 'const d = new ' + 'Date();\n';

describe('lint_deterministic_time — the real tree', () => {
    it('passes: every gate script routes through the as-of seam', () => {
        const { code, findings } = check(REPO_ROOT);
        expect(findings).toEqual([]);
        expect(code).toBe(0);
    });

    it('scans a real corpus, not an empty one', () => {
        // The collapse case: a moved flat-`src/` scan root, or a prefix filter
        // that stopped matching, reads nothing and reports clean. The live count
        // is 261; the manifest floor is 200.
        expect(gateScripts(REPO_ROOT).length).toBeGreaterThan(200);
    });

    it('exits 2 on a dead scan root rather than reporting clean', () => {
        expect(main(['--quiet', '--root', join(REPO_ROOT, 'no-such-root')])).toBe(2);
    });
});

describe('lint_deterministic_time — detection', () => {
    it('flags a raw clock read in a check_ script', () => {
        const findings = scanSource('src/scripts/check_x.ts', RAW_NOW);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.kind).toBe('raw');
        expect(findings[0]?.line).toBe(1);
    });

    it('flags a bare constructor in a lint_ script', () => {
        expect(scanSource('src/scripts/lint_x.ts', RAW_NEW)).toHaveLength(1);
    });

    it('reds end to end on a planted gate script', () => {
        const root = fixtureRoot({ 'check_planted.ts': RAW_NOW });
        try {
            expect(main(['--quiet', '--root', root])).toBe(1);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('greens on a fixture whose gates route through the seam', () => {
        const root = fixtureRoot({
            'check_ok.ts': 'import { asOf } from ' + "'./_lib/as_of.js';\nconst n = asOf();\n",
        });
        try {
            expect(main(['--quiet', '--root', root])).toBe(0);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('lint_deterministic_time — the escape hatch', () => {
    it('accepts a marker carrying a reason', () => {
        const src = RAW_NOW.trimEnd() + ' // wall-clock-required: elapsed-duration probe\n';
        expect(scanSource('src/scripts/check_x.ts', src)).toEqual([]);
    });

    it('rejects a marker with no reason — a bare marker is not a justification', () => {
        const src = RAW_NOW.trimEnd() + ' // wall-clock-required:\n';
        const findings = scanSource('src/scripts/check_x.ts', src);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.kind).toBe('bare-marker');
    });
});

describe('stripNonCode — the two defects the real corpus exposed', () => {
    it('does not collapse a parsed date into a bare constructor (false positive)', () => {
        // `check_knowledge_pages.ts:103` is this exact shape. Blanking the string
        // body to spaces would leave `new Date(            )`, which the
        // empty-parens pattern matches.
        const src = 'const due = new ' + 'Date("2026-01-01T00:00:00Z");\n';
        expect(scanSource('src/scripts/check_x.ts', src)).toEqual([]);
    });

    it('sees a clock read inside a template substitution (missed finding)', () => {
        // `check_gate_coverage.ts:982` is this exact shape. Blanking the whole
        // template literal reported the file clean.
        const src = 'const id = `x-${new ' + 'Date().toISOString()}`;\n';
        expect(scanSource('src/scripts/check_x.ts', src)).toHaveLength(1);
    });

    it('ignores a mention in a comment or a string, so the gate does not refuse itself', () => {
        const src =
            '// forbids ' + 'Date' + '.now()\nconst s = "new ' + 'Date()";\nconst u = 1;\n';
        expect(scanSource('src/scripts/lint_deterministic_time.ts', src)).toEqual([]);
    });

    it('preserves line count and line lengths so a finding cites the source line', () => {
        const src = 'const a = 1;\n// comment\nconst b = "str";\nconst c = `t${1}`;\n';
        const stripped = stripNonCode(src);
        expect(stripped.split('\n')).toHaveLength(src.split('\n').length);
        for (const [i, line] of stripped.split('\n').entries()) {
            expect(line.length).toBe(src.split('\n')[i]?.length);
        }
    });
});
