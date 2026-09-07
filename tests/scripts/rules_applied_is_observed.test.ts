/**
 * road-to-observed-learning-signal Phase 4 — `rules_applied` becomes an
 * observation.
 *
 * The measurement that motivated it: mining the real audit stream with
 * `extract_audit_patterns --min-count 2` minted exactly ONE pattern,
 * `implement:success:delegation-policy`, at count 1074 over 1104 lines. That is
 * not a behavioural regularity — both shipped producers wrote the literal
 * `['delegation-policy']` on every line, so the "pattern" was arithmetic over a
 * constant and every per-asset reader downstream was aggregating the writer.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as url from 'node:url';

import { describe, expect, it } from 'vitest';

import { appliedIds, PRODUCER_CONSTANT_FIELDS } from '../../src/scripts/_lib/audit_field_provenance.js';
import { buildOrchestrationLine, type RecordInput } from '../../src/scripts/_lib/orchestration_record.js';
import { buildReviewSkippedLine } from '../../src/scripts/_lib/review_skipped_record.js';

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');

const BASE: RecordInput = {
    spawn_count: 1,
    token_delta: -72000,
    ts: '2026-09-07T12:00:00.000Z',
    id: 'BASE1',
};

/** A fixture stream of MIXED runs: distinct work_ids, three rule sets. */
function writeFixtureStream(dir: string): number {
    const sets = [
        ['delegation-policy'],
        ['delegation-policy', 'verify-before-complete'],
        ['minimal-safe-diff'],
    ];
    const lines: string[] = [];
    let n = 0;
    for (const [i, rules] of sets.entries()) {
        // Two INDEPENDENT runs per set: `count` is the number of distinct
        // work_ids, and `--min-count 2` is the independence floor.
        for (const run of [0, 1]) {
            n += 1;
            const { line, errors } = buildOrchestrationLine({
                ...BASE,
                id: `FIX${i}${run}`,
                work_id: `work-${i}-${run}`,
                rules_applied: rules,
            });
            expect(errors).toEqual([]);
            lines.push(JSON.stringify(line));
        }
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '2026-09.jsonl'), lines.join('\n') + '\n', 'utf-8');
    return n;
}

function mine(dir: string): Array<Record<string, unknown>> {
    const out = execFileSync(
        'npx',
        ['tsx', 'src/scripts/extract_audit_patterns.ts', '--audit-dir', dir, '--min-count', '2', '--json'],
        { cwd: REPO, encoding: 'utf-8' },
    );
    return JSON.parse(out) as Array<Record<string, unknown>>;
}

// ── 4.1 ───────────────────────────────────────────────────────────
describe('4.1 — both shipped producers compute the field', () => {
    it('an omitted rules_applied is an EMPTY list, never a fabricated id', () => {
        const orch = buildOrchestrationLine(BASE).line as Record<string, unknown>;
        expect(orch.rules_applied).toEqual([]);
        const rev = buildReviewSkippedLine({
            diff_lines: 12,
            mutation_measure: 'exact',
            ts: BASE.ts,
            id: 'REV1',
        }).line as Record<string, unknown>;
        expect(rev.rules_applied).toEqual([]);
        // The literal that used to be written unconditionally is gone.
        expect(JSON.stringify(orch.rules_applied)).not.toContain('delegation-policy');
        expect(JSON.stringify(rev.rules_applied)).not.toContain('delegation-policy');
    });

    it('a supplied list is carried, de-duplicated and bounded', () => {
        const line = buildOrchestrationLine({
            ...BASE,
            rules_applied: ['scope-control', ' scope-control ', '', 'commit-policy'],
        }).line as Record<string, unknown>;
        expect(line.rules_applied).toEqual(['scope-control', 'commit-policy']);
        expect(appliedIds(Array.from({ length: 40 }, (_, i) => `r${i}`))).toHaveLength(32);
    });

    it('mining a mixed fixture stream returns more than one pattern, top count below the line count', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-fixture-'));
        try {
            const lineCount = writeFixtureStream(dir);
            const patterns = mine(dir);
            expect(patterns.length).toBeGreaterThan(1);
            const top = Math.max(...patterns.map((p) => Number(p.count)));
            expect(top).toBeLessThan(lineCount);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('the OLD constant shape is what a single all-lines pattern looks like', () => {
        // The discriminator: with one fixed value on every line, mining mints
        // ONE pattern whose count EQUALS the line count. This is the shape the
        // real stream had, and the reason the card existed.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-constant-'));
        try {
            const lines: string[] = [];
            for (let i = 0; i < 6; i++) {
                const { line } = buildOrchestrationLine({
                    ...BASE,
                    id: `CONST${i}`,
                    work_id: `work-${i}`,
                    rules_applied: ['delegation-policy'],
                });
                lines.push(JSON.stringify(line));
            }
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, '2026-09.jsonl'), lines.join('\n') + '\n', 'utf-8');
            const patterns = mine(dir);
            expect(patterns).toHaveLength(1);
            expect(Number(patterns[0]?.count)).toBe(6);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ── 4.2 ───────────────────────────────────────────────────────────
describe('4.2 — the constant registration and the card are retired together', () => {
    it('rules_applied is absent from PRODUCER_CONSTANT_FIELDS', () => {
        expect(PRODUCER_CONSTANT_FIELDS.has('rules_applied')).toBe(false);
    });

    it('neither producer writes the retired literal any more', () => {
        for (const p of [
            'src/scripts/_lib/orchestration_record.ts',
            'src/scripts/_lib/review_skipped_record.ts',
        ]) {
            const src = fs.readFileSync(path.join(REPO, p), 'utf-8');
            expect(src, `${p} still writes the constant`).not.toContain(
                "rules_applied: ['delegation-policy']",
            );
        }
    });

    it('the card is marked retired against the run that falsified it', () => {
        const raw = fs.readFileSync(
            path.join(REPO, 'agents/knowledge/experience-rules-applied-is-a-producer-constant.md'),
            'utf-8',
        );
        expect(raw).toMatch(/^retired:/m);
        expect(raw).toMatch(/road-to-observed-learning-signal/);
    });
});
