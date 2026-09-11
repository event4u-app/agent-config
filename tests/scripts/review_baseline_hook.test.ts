/**
 * `review-baseline` — the session-start baseline `end-review-nudge` subtracts.
 *
 * The case that motivated it is the last describe block: a branch carrying 1,771
 * lines of another session's uncommitted work, and a turn that changed five
 * lines. Before the baseline the nudge fired on 1,771 every turn and became
 * noise; after it, that turn measures five and stays silent.
 *
 * The three fallbacks get their own tests, because all three resolve to the
 * UNSUBTRACTED count and that is by construction an invisible failure — a line
 * reading 1,771 is indistinguishable from a session that really mutated 1,771
 * unless the telemetry says which path produced it.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import {
    applyBaseline,
    baselineStateFile,
    currentHeadSha,
    parseBaseline,
    readBaseline,
    type ReviewBaseline,
} from '../../src/scripts/_lib/review_baseline.js';
import { buildReviewSkippedLine } from '../../src/scripts/_lib/review_skipped_record.js';
import { deriveSessionKey } from '../../src/scripts/hooks/end_review_nudge_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'review_baseline_hook.ts');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

const tmp_dirs: string[] = [];
afterAll(() => {
    for (const d of tmp_dirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* a temp dir that will not delete is not a test failure */
        }
    }
});

function makeRoot(): string {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'review-baseline-')));
    tmp_dirs.push(d);
    return d;
}

function writeBaselineFile(root: string, key: string, body: unknown): void {
    const file = baselineStateFile(root, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
}

const BASE: ReviewBaseline = {
    head_sha: 'abc123',
    baseline_lines: 1771,
    measure: 'exact',
    written_at: '2026-09-11T10:00:00.000Z',
};

describe('parseBaseline', () => {
    it('reads a well-formed record', () => {
        expect(parseBaseline(JSON.stringify(BASE))).toEqual(BASE);
    });

    it('treats a missing HEAD as null rather than as a parse failure', () => {
        // A workspace with no git repo, or no commit yet, is a real state and
        // not a corrupt record — applyBaseline compares null to null happily.
        const rec = parseBaseline(
            JSON.stringify({ head_sha: null, baseline_lines: 0, written_at: BASE.written_at }),
        );
        expect(rec).not.toBeNull();
        expect(rec!.head_sha).toBeNull();
    });

    it('refuses anything whose line count is not a non-negative number', () => {
        for (const bad of [
            '{ not json',
            JSON.stringify({ baseline_lines: -1, written_at: 'x' }),
            JSON.stringify({ baseline_lines: 'many', written_at: 'x' }),
            JSON.stringify({ baseline_lines: 5 }),
            JSON.stringify([1, 2, 3]),
        ]) {
            expect(parseBaseline(bad)).toBeNull();
        }
    });
});

describe('readBaseline keeps absent and unreadable apart', () => {
    it('reports absent when no file was ever written', () => {
        expect(readBaseline(makeRoot(), 'no-such-session')).toBe('absent');
    });

    it('reports unreadable when the file is there and malformed', () => {
        // Collapsing this into `absent` would hide a corrupt write inside the
        // population it is smallest against — every session on a host with no
        // session_start slot reads `absent` legitimately.
        const root = makeRoot();
        writeBaselineFile(root, 'sess', '{ truncated');
        expect(readBaseline(root, 'sess')).toBe('unreadable');
    });

    it('reads back what was written', () => {
        const root = makeRoot();
        writeBaselineFile(root, 'sess', BASE);
        expect(readBaseline(root, 'sess')).toEqual(BASE);
    });
});

describe('applyBaseline', () => {
    it('subtracts when HEAD still matches', () => {
        const out = applyBaseline(1776, BASE, () => 'abc123');
        expect(out.applied).toBe(true);
        expect(out.lines).toBe(5);
    });

    it('clamps at zero when the session reverted part of the dirty tree', () => {
        // Without the clamp a negative count compares below the threshold as if
        // nothing happened — for a session that deleted a thousand lines.
        const out = applyBaseline(700, BASE, () => 'abc123');
        expect(out.applied).toBe(true);
        expect(out.lines).toBe(0);
    });

    it('falls back to the UNSUBTRACTED count when HEAD moved', () => {
        // A session that committed mid-run moved `git diff HEAD`'s base, so the
        // subtraction would be arithmetic over two different quantities. Falling
        // back over-reports, which is the safe direction; absorbing it would
        // under-report on exactly the sessions that did the most work.
        const out = applyBaseline(1776, BASE, () => 'def456');
        expect(out.applied).toBe(false);
        expect(out.lines).toBe(1776);
        expect(out.applied === false && out.fallback).toBe('head-moved');
    });

    it('falls back on absent and on unreadable, carrying each reason through', () => {
        for (const state of ['absent', 'unreadable'] as const) {
            const out = applyBaseline(1776, state, () => 'abc123');
            expect(out.applied).toBe(false);
            expect(out.lines).toBe(1776);
            expect(out.applied === false && out.fallback).toBe(state);
        }
    });

    it('matches a null HEAD against a null HEAD', () => {
        const noRepo: ReviewBaseline = { ...BASE, head_sha: null, baseline_lines: 10 };
        const out = applyBaseline(60, noRepo, () => null);
        expect(out.applied).toBe(true);
        expect(out.lines).toBe(50);
    });

    it('refuses to subtract a capped approximation from an exact count', () => {
        // Past UNTRACKED_FILE_CAP the count is a synthetic THRESHOLD + 1 +
        // tracked, chosen to be over the bar rather than to be true. Subtracting
        // it from a later exact measurement is arithmetic over two different
        // quantities — the same defect head-moved catches on its own axis.
        const capped: ReviewBaseline = { ...BASE, measure: 'capped_approximation' };
        const out = applyBaseline(1776, capped, () => 'abc123', 'exact');
        expect(out.applied).toBe(false);
        expect(out.lines).toBe(1776);
        expect(out.applied === false && out.fallback).toBe('mixed-measure');
    });

    it('refuses in the other direction too', () => {
        const out = applyBaseline(1776, BASE, () => 'abc123', 'capped_approximation');
        expect(out.applied === false && out.fallback).toBe('mixed-measure');
    });

    it('refuses a record written before the measure existed', () => {
        // Absent reads as unknown, never as the more permissive `exact`.
        const { measure: _drop, ...legacy } = BASE;
        const out = applyBaseline(1776, legacy as ReviewBaseline, () => 'abc123');
        expect(out.applied === false && out.fallback).toBe('mixed-measure');
    });

    it('does not read HEAD on a branch that discards the value', () => {
        // P1: `git rev-parse` costs 11-14 ms and the absent/unreadable branches
        // are the steady state on every host without this nudge. The thunk is
        // what keeps that spawn off those stops; a counter proves it stayed one.
        let calls = 0;
        const head = (): string | null => {
            calls += 1;
            return 'abc123';
        };
        applyBaseline(1776, 'absent', head);
        applyBaseline(1776, 'unreadable', head);
        expect(calls).toBe(0);
        applyBaseline(1776, BASE, head);
        expect(calls).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// The hook itself — main(), through the real process
// ---------------------------------------------------------------------------

describe('review_baseline_hook main()', () => {
    function runHook(cwd: string, event: string, sessionId: string) {
        const stdin = JSON.stringify({
            schema_version: 1,
            platform: 'claude',
            event,
            native_event: 'SessionStart',
            session_id: sessionId,
            workspace_root: cwd,
            payload: {},
            settings: {},
        });
        const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd, input: stdin });
        return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
    }

    /** A real repo, because the hook shells out to git and counts real lines. */
    function makeRepo(): string {
        const dir = makeRoot();
        for (const args of [
            ['init', '-q'],
            ['config', 'user.email', 't@example.com'],
            ['config', 'user.name', 'T'],
        ]) {
            spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
        }
        fs.writeFileSync(path.join(dir, 'seed.ts'), 'export const a = 1;\n');
        spawnSync('git', ['add', '-A'], { cwd: dir, encoding: 'utf8' });
        spawnSync('git', ['commit', '-qm', 'seed'], { cwd: dir, encoding: 'utf8' });
        return dir;
    }

    it('writes a baseline on session_start, and stays silent doing it', () => {
        const dir = makeRepo();
        fs.writeFileSync(path.join(dir, 'dirty.ts'), 'const a = 1;\nconst b = 2;\n');
        const r = runHook(dir, 'session_start', 'sess-write');
        expect(r.status).toBe(0);
        expect(r.stdout.trim()).toBe(''); // capture only — it emits no context
        const rec = readBaseline(dir, deriveSessionKey({ session_id: 'sess-write' }, {}));
        expect(rec).not.toBe('absent');
        expect(rec).not.toBe('unreadable');
        const baseline = rec as ReviewBaseline;
        expect(baseline.baseline_lines).toBe(2);
        expect(baseline.measure).toBe('exact');
        expect(baseline.head_sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it('does NOT re-baseline on a second session_start', () => {
        // The guard the hook's own comment calls the protection against silent
        // failure, and which nothing exercised. A host that fires session_start
        // twice — Cline maps TaskStart and TaskResume onto it — would otherwise
        // fold the session's own work into its baseline and go quiet for good.
        const dir = makeRepo();
        fs.writeFileSync(path.join(dir, 'dirty.ts'), 'const a = 1;\nconst b = 2;\n');
        runHook(dir, 'session_start', 'sess-twice');
        fs.writeFileSync(path.join(dir, 'more.ts'), 'x\n'.repeat(300));
        runHook(dir, 'session_start', 'sess-twice');
        const rec = readBaseline(dir, deriveSessionKey({ session_id: 'sess-twice' }, {})) as
            | ReviewBaseline
            | string;
        expect((rec as ReviewBaseline).baseline_lines).toBe(2);
    });

    it('ignores every event that is not session_start', () => {
        const dir = makeRepo();
        expect(runHook(dir, 'stop', 'sess-wrong-event').status).toBe(0);
        expect(readBaseline(dir, deriveSessionKey({ session_id: 'sess-wrong-event' }, {}))).toBe(
            'absent',
        );
    });

    it('records zero on a clean tree rather than refusing to write', () => {
        // A zero baseline is a real answer: it means the session starts clean and
        // every line it measures later is its own.
        const dir = makeRepo();
        runHook(dir, 'session_start', 'sess-clean');
        const rec = readBaseline(dir, deriveSessionKey({ session_id: 'sess-clean' }, {}));
        expect((rec as ReviewBaseline).baseline_lines).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Producer → consumer, through both real hooks
// ---------------------------------------------------------------------------

describe('the nudge subtracts what the baseline recorded', () => {
    const NUDGE = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'end_review_nudge_hook.ts');

    function repoWithDirt(lines: number): string {
        const dir = makeRoot();
        for (const args of [
            ['init', '-q'],
            ['config', 'user.email', 't@example.com'],
            ['config', 'user.name', 'T'],
        ]) {
            spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
        }
        fs.writeFileSync(path.join(dir, 'seed.ts'), 'export const a = 1;\n');
        // Production reality, and NOT fixture convenience: this repository
        // gitignores `agents/runtime/`, so the baseline file the session_start
        // hook writes is invisible to `git ls-files --others`. Without the line,
        // the fixture measured the mechanism's own 6-line state file as session
        // mutation — a real observation about an unignored consumer, and the
        // wrong thing to bake into an assertion about subtraction.
        fs.writeFileSync(path.join(dir, '.gitignore'), 'agents/runtime/\n');
        spawnSync('git', ['add', '-A'], { cwd: dir, encoding: 'utf8' });
        spawnSync('git', ['commit', '-qm', 'seed'], { cwd: dir, encoding: 'utf8' });
        fs.writeFileSync(path.join(dir, 'pre.ts'), 'x\n'.repeat(lines));
        return dir;
    }

    function run(script: string, cwd: string, event: string, sessionId: string) {
        const stdin = JSON.stringify({
            schema_version: 1,
            platform: 'claude',
            event,
            native_event: event === 'stop' ? 'Stop' : 'SessionStart',
            session_id: sessionId,
            workspace_root: cwd,
            payload: {},
            settings: {},
        });
        const r = spawnSync(TSX, [script], { encoding: 'utf8', cwd, input: stdin });
        return { status: r.status ?? -1, stdout: r.stdout ?? '' };
    }

    it('a small turn on a 200-line dirty tree does not fire the nudge', () => {
        // The measured failure, in miniature. Unsubtracted, 205 clears the
        // 50-line threshold on every turn of the session. Both hooks derive the
        // session key from the same envelope through the same exported function,
        // so this exercises the real keying rather than a shared constant.
        const dir = repoWithDirt(200);
        expect(run(HOOK, dir, 'session_start', 'sess-e2e').status).toBe(0);
        fs.writeFileSync(path.join(dir, 'mine.ts'), 'y\n'.repeat(5));
        const stop = run(NUDGE, dir, 'stop', 'sess-e2e');
        expect(stop.status).toBe(0);
        expect(stop.stdout.trim()).toBe('');
    });

    it('and a large turn on the same tree still does', () => {
        // The half that proves the fix did not simply disarm the nudge.
        const dir = repoWithDirt(200);
        expect(run(HOOK, dir, 'session_start', 'sess-e2e-big').status).toBe(0);
        fs.writeFileSync(path.join(dir, 'mine.ts'), 'y\n'.repeat(300));
        const stop = run(NUDGE, dir, 'stop', 'sess-e2e-big');
        expect(stop.status).toBe(2); // EXIT_WARN
        expect(JSON.parse(stop.stdout.trim())['reason']).toContain('300 non-doc lines');
    });

    it('without a baseline it fires on the whole dirty tree, as it always did', () => {
        // The degradation path. No session_start ran, so `readBaseline` reads
        // absent and the nudge reports the unsubtracted count — exactly its
        // behaviour before this mechanism existed.
        const dir = repoWithDirt(200);
        const stop = run(NUDGE, dir, 'stop', 'sess-e2e-nobaseline');
        expect(stop.status).toBe(2);
        expect(JSON.parse(stop.stdout.trim())['reason']).toContain('200 non-doc lines');
    });
});

describe('currentHeadSha', () => {
    it('returns null for a directory that is not a repository, without throwing', () => {
        expect(currentHeadSha(makeRoot())).toBeNull();
    });
});

describe('the telemetry row carries which path produced the count', () => {
    it('records the baseline application when one is supplied', () => {
        const { line, errors } = buildReviewSkippedLine({
            diff_lines: 60,
            mutation_measure: 'exact',
            ts: '2026-09-11T10:00:00.000Z',
            id: 'id-1',
            baseline: 'applied',
        });
        expect(errors).toEqual([]);
        expect((line!['review_skipped'] as Record<string, unknown>)['baseline']).toBe('applied');
    });

    it('OMITS the field when the producer recorded nothing', () => {
        // Absent means "not recorded", the same split audit-log-v1 uses for
        // `skills_applied`. Defaulting it to `absent` would assert a measurement
        // a pre-baseline producer never made.
        const { line } = buildReviewSkippedLine({
            diff_lines: 60,
            mutation_measure: 'exact',
            ts: '2026-09-11T10:00:00.000Z',
            id: 'id-2',
        });
        expect(Object.keys(line!['review_skipped'] as object)).toEqual([
            'diff_lines',
            'mutation_measure',
        ]);
    });

    it('refuses a value outside the closed enum rather than writing it', () => {
        const { line, errors } = buildReviewSkippedLine({
            diff_lines: 60,
            mutation_measure: 'exact',
            ts: '2026-09-11T10:00:00.000Z',
            id: 'id-3',
            baseline: 'probably fine' as never,
        });
        expect(line).toBeNull();
        expect(errors.join(' ')).toContain('baseline must be one of');
    });
});

describe('the 1,771-line accumulator branch', () => {
    it('a five-line turn no longer clears the fire threshold', () => {
        // MUTATION_LINE_THRESHOLD is 50. Unsubtracted, 1,776 clears it on every
        // turn of the session — which is the measured failure. Subtracted, the
        // same turn measures 5.
        const root = makeRoot();
        writeBaselineFile(root, 'accumulator', BASE);
        const out = applyBaseline(1776, readBaseline(root, 'accumulator'), () => 'abc123');
        expect(out.lines).toBe(5);
        expect(out.lines).toBeLessThanOrEqual(50);
    });

    it('and a genuinely large turn on the same branch still does', () => {
        // The half that proves the fix did not simply disarm the nudge.
        const root = makeRoot();
        writeBaselineFile(root, 'accumulator', BASE);
        const out = applyBaseline(1771 + 300, readBaseline(root, 'accumulator'), () => 'abc123');
        expect(out.lines).toBe(300);
        expect(out.lines).toBeGreaterThan(50);
    });
});
