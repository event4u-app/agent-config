/**
 * End-review nudge — `stop` concern
 * (`src/scripts/hooks/end_review_nudge_hook.ts`, road-to-orchestrator-
 * discipline-carriers Phase 5).
 *
 * Two layers, mirroring `team_review_gate_hook.test.ts`'s E2E-via-tsx shape:
 *   - Unit tests over the exported pure helpers (numstat parsing, doc-path
 *     filtering, transcript scanning, the advisory line).
 *   - E2E: spawns the hook via tsx with a dispatcher envelope on stdin
 *     against a real temp git repo + a real transcript file, asserting the
 *     four roadmap scenarios (mutation+no-reviewer → injection + telemetry;
 *     doc-only → silence; reviewer-ran → silence; malformed → silent exit 0).
 *
 * All fixtures live under `os.tmpdir()` — no tracked file is ever written.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    buildAdvisoryLine,
    deriveSessionKey,
    gitNumstatRows,
    hasFiredThisSession,
    isDocPath,
    MUTATION_LINE_THRESHOLD,
    nonDocMutatedLines,
    parseNumstat,
    scanTranscriptForReviewer,
    totalNonDocMutatedLines,
    UNTRACKED_FILE_CAP,
    untrackedFileLineCount,
    untrackedNonDocFiles,
} from '../../src/scripts/hooks/end_review_nudge_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'end_review_nudge_hook.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tmp_dirs: string[] = [];

afterEach(() => {
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

// ── Pure-helper unit tests ──────────────────────────────────────────────

describe('parseNumstat', () => {
    it('parses added/deleted/path rows, treating binary "-" as 0', () => {
        const rows = parseNumstat('10\t5\tsrc/a.ts\n3\t0\tREADME.md\n-\t-\tbin/blob\n');
        expect(rows).toEqual([
            { added: 10, deleted: 5, path: 'src/a.ts' },
            { added: 3, deleted: 0, path: 'README.md' },
            { added: 0, deleted: 0, path: 'bin/blob' },
        ]);
    });

    it('ignores blank lines and non-matching garbage', () => {
        expect(parseNumstat('\n\nnot a numstat line\n')).toEqual([]);
    });
});

describe('isDocPath / nonDocMutatedLines', () => {
    it('excludes .md paths (case-insensitive) from the mutation sum', () => {
        expect(isDocPath('docs/guide.MD')).toBe(true);
        expect(isDocPath('src/a.ts')).toBe(false);
        const rows = [
            { added: 40, deleted: 20, path: 'src/a.ts' },
            { added: 100, deleted: 100, path: 'docs/notes.md' },
        ];
        expect(nonDocMutatedLines(rows)).toBe(60);
    });

    it('sums to 0 when every row is a doc path', () => {
        const rows = [
            { added: 200, deleted: 50, path: 'README.md' },
            { added: 30, deleted: 10, path: 'docs/adr/ADR-1.md' },
        ];
        expect(nonDocMutatedLines(rows)).toBe(0);
    });
});

describe('gitNumstatRows', () => {
    it('fails closed to [] outside any git repository', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
        tmp_dirs.push(dir);
        expect(gitNumstatRows(dir)).toEqual([]);
    });
});

// ── F6: untracked files are invisible to `git diff --numstat HEAD` ──────

describe('untrackedNonDocFiles / untrackedFileLineCount / totalNonDocMutatedLines (F6)', () => {
    it('untrackedNonDocFiles fails closed to [] outside any git repository', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
        tmp_dirs.push(dir);
        expect(untrackedNonDocFiles(dir)).toEqual([]);
    });

    it('lists a brand-new untracked file and excludes an untracked .md file', () => {
        const dir = makeRepo();
        fs.writeFileSync(path.join(dir, 'new-module.ts'), 'export const x = 1;\n');
        fs.writeFileSync(path.join(dir, 'NOTES.md'), '# notes\n');
        expect(untrackedNonDocFiles(dir)).toEqual(['new-module.ts']);
    });

    it('gitNumstatRows(HEAD) is blind to a brand-new untracked file — the exact gap F6 closes', () => {
        const dir = makeRepo();
        const lines = Array.from({ length: 30 }, (_v, i) => `export const line_${i} = ${i};`);
        fs.writeFileSync(path.join(dir, 'new-module.ts'), `${lines.join('\n')}\n`);
        expect(nonDocMutatedLines(gitNumstatRows(dir))).toBe(0);
        expect(untrackedFileLineCount(dir, 'new-module.ts')).toBe(30);
    });

    it('totalNonDocMutatedLines sums tracked + untracked non-doc lines', () => {
        const dir = makeRepo();
        mutateCodeFile(dir, 10); // tracked mutation
        const lines = Array.from({ length: 15 }, (_v, i) => `export const line_${i} = ${i};`);
        fs.writeFileSync(path.join(dir, 'new-module.ts'), `${lines.join('\n')}\n`);
        expect(totalNonDocMutatedLines(dir)).toBe(25);
    });

    it('an untracked .md file contributes nothing (the doc carve-out applies to untracked files too)', () => {
        const dir = makeRepo();
        fs.writeFileSync(
            path.join(dir, 'NOTES.md'),
            Array.from({ length: 200 }, (_v, i) => `line ${i}`).join('\n'),
        );
        expect(totalNonDocMutatedLines(dir)).toBe(0);
    });

    it('past UNTRACKED_FILE_CAP untracked files, the count degrades to a value guaranteed over threshold', () => {
        const dir = makeRepo();
        for (let i = 0; i < UNTRACKED_FILE_CAP + 1; i++) {
            fs.writeFileSync(path.join(dir, `file-${i}.ts`), 'export const x = 1;\n');
        }
        expect(totalNonDocMutatedLines(dir)).toBeGreaterThan(MUTATION_LINE_THRESHOLD);
    });
});

function toolUseLine(name: string, input: Record<string, unknown>): string {
    return JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name, input }] },
    });
}

describe('scanTranscriptForReviewer', () => {
    it('false on an empty or garbage transcript', () => {
        expect(scanTranscriptForReviewer('')).toBe(false);
        expect(scanTranscriptForReviewer('not json\n{"broken":\n')).toBe(false);
    });

    it('false when the only tool_use is an unrelated Bash command', () => {
        const text = toolUseLine('Bash', { command: 'npm test' });
        expect(scanTranscriptForReviewer(text)).toBe(false);
    });

    it('true on an Agent/Task dispatch with a review-shaped prompt', () => {
        const text = toolUseLine('Agent', {
            description: 'Independent review of the diff',
            prompt: 'Give an adversarial review of this change.',
            subagent_type: 'general-purpose',
        });
        expect(scanTranscriptForReviewer(text)).toBe(true);
    });

    it('true on an Agent dispatch whose subagent_type is judge-shaped', () => {
        const text = toolUseLine('Task', { prompt: 'x', subagent_type: 'judge-code-quality' });
        expect(scanTranscriptForReviewer(text)).toBe(true);
    });

    it('true on a Skill invocation naming a review/judge skill', () => {
        const text = toolUseLine('Skill', { skill: 'review-changes' });
        expect(scanTranscriptForReviewer(text)).toBe(true);
    });

    it('true on a Skill invocation naming a judge-* skill via the "command" field', () => {
        const text = toolUseLine('Skill', { command: 'judge-solo' });
        expect(scanTranscriptForReviewer(text)).toBe(true);
    });

    it('false on a Skill invocation naming an unrelated skill', () => {
        const text = toolUseLine('Skill', { skill: 'code-refactoring' });
        expect(scanTranscriptForReviewer(text)).toBe(false);
    });

    it('scans the whole transcript, not just the last line', () => {
        const lines = [
            JSON.stringify({ type: 'user', message: { content: 'do the thing' } }),
            toolUseLine('Bash', { command: 'git status' }),
            toolUseLine('Agent', { prompt: 'run a blind review of the diff' }),
            toolUseLine('Bash', { command: 'git commit' }),
        ];
        expect(scanTranscriptForReviewer(lines.join('\n'))).toBe(true);
    });

    // ── F15: bare `\breview\b` in free-form PROMPT text false-positives ──
    it('F15: a bare "review" in ordinary PROMPT prose does NOT count (false-positive fix)', () => {
        const text = toolUseLine('Agent', { prompt: 'update the review docs' });
        expect(scanTranscriptForReviewer(text)).toBe(false);
    });

    it('F15: the same bare "review" keyword in the LABEL (description) still counts', () => {
        const text = toolUseLine('Agent', { description: 'update the review docs' });
        expect(scanTranscriptForReviewer(text)).toBe(true);
    });

    it('F15: a specific review-shaped PHRASE in prompt text still counts', () => {
        for (const phrase of [
            'give this a code review',
            'run a neutral review of the diff',
            'get an adversarial pass',
            'ask a judge to look at this',
            'I want a critique of this change',
            'get a second opinion before merging',
        ]) {
            expect(scanTranscriptForReviewer(toolUseLine('Agent', { prompt: phrase }))).toBe(true);
        }
    });
});

// ── F2: derive + check the once-per-session fire-gate key ──────────────

describe('deriveSessionKey / hasFiredThisSession (F2)', () => {
    it('derives a stable, hex-shaped key from session_id', () => {
        const key = deriveSessionKey({ session_id: 'sess-abc' }, {});
        expect(key).toMatch(/^[a-f0-9]{16}$/);
        expect(deriveSessionKey({ session_id: 'sess-abc' }, {})).toBe(key); // deterministic
    });

    it('a different session_id derives a different key', () => {
        expect(deriveSessionKey({ session_id: 'sess-a' }, {})).not.toBe(
            deriveSessionKey({ session_id: 'sess-b' }, {}),
        );
    });

    it('falls back to payload.transcript_path when session_id is absent', () => {
        const key = deriveSessionKey({}, { transcript_path: '/tmp/some/transcript.jsonl' });
        expect(key).toMatch(/^[a-f0-9]{16}$/);
    });

    it('hasFiredThisSession is false before any marker is written, for a fresh repo', () => {
        const dir = makeRepo();
        expect(hasFiredThisSession(dir, deriveSessionKey({ session_id: 'sess-x' }, {}))).toBe(false);
    });
});

describe('buildAdvisoryLine', () => {
    it('renders the exact wording with the measured line count', () => {
        expect(buildAdvisoryLine(87)).toBe(
            'this session mutated 87 lines without a neutral review; ' +
                'spawn a cross-model reviewer before claiming done (delegation-policy / verify-budget)',
        );
    });
});

// ── E2E via tsx: the four roadmap scenarios ─────────────────────────────

function sh(cmd: string, args: string[], cwd: string): void {
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(' ')} failed: ${r.stderr}`);
    }
}

/** A real, initialised git repo with one committed baseline file. */
function makeRepo(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'end-review-nudge-')));
    tmp_dirs.push(dir);
    sh('git', ['init', '-q'], dir);
    sh('git', ['config', 'user.email', 'test@example.com'], dir);
    sh('git', ['config', 'user.name', 'Test'], dir);
    fs.writeFileSync(path.join(dir, 'baseline.ts'), 'export const baseline = 1;\n');
    sh('git', ['add', '-A'], dir);
    sh('git', ['commit', '-q', '-m', 'init'], dir);
    return dir;
}

/**
 * Append exactly `n` added lines to a tracked, non-doc file — an
 * uncommitted mutation. The baseline file already ends in `\n`, so the
 * appended text carries NO leading newline (that would count as an extra
 * added blank line and throw off the exact-count assertions below).
 */
function mutateCodeFile(dir: string, n: number): void {
    const p = path.join(dir, 'baseline.ts');
    const extra = Array.from({ length: n }, (_v, i) => `export const line_${i} = ${i};`).join('\n');
    fs.appendFileSync(p, `${extra}\n`);
}

/** Add a large uncommitted change to a NEW, tracked .md file only. */
function mutateDocOnly(dir: string, n: number): void {
    const p = path.join(dir, 'NOTES.md');
    fs.writeFileSync(p, Array.from({ length: n }, (_v, i) => `line ${i}`).join('\n'));
    sh('git', ['add', 'NOTES.md'], dir);
}

/** Write a JSONL transcript file at `dir/transcript.jsonl`, return its path. */
function writeTranscript(dir: string, lines: string[]): string {
    const p = path.join(dir, 'transcript.jsonl');
    fs.writeFileSync(p, `${lines.join('\n')}\n`);
    return p;
}

function envelopeJson(workspaceRoot: string, transcriptPath?: string): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'stop',
        native_event: 'Stop',
        session_id: 'sess-e2e',
        workspace_root: workspaceRoot,
        payload: transcriptPath ? { transcript_path: transcriptPath } : {},
        settings: {},
    });
}

function runHook(cwd: string, stdin: string): { status: number; stdout: string; stderr: string } {
    const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd, input: stdin });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function readTelemetryLines(dir: string): Array<Record<string, unknown>> {
    const auditDir = path.join(dir, 'agents', 'runtime', 'state', 'audit');
    if (!fs.existsSync(auditDir)) return [];
    const files = fs.readdirSync(auditDir).filter((f) => f.endsWith('.jsonl'));
    const out: Array<Record<string, unknown>> = [];
    for (const f of files) {
        for (const line of fs.readFileSync(path.join(auditDir, f), 'utf-8').trim().split('\n')) {
            if (line) out.push(JSON.parse(line) as Record<string, unknown>);
        }
    }
    return out;
}

describe('end_review_nudge_hook — stop-concern E2E (via tsx)', () => {
    it('mutation over threshold + no reviewer → injects the advisory line + writes review_skipped telemetry', () => {
        const dir = makeRepo();
        mutateCodeFile(dir, MUTATION_LINE_THRESHOLD + 20); // well over 50
        const r = runHook(dir, envelopeJson(dir));
        // The dispatcher-internal exit is EXIT_WARN (2) so `host_semantics.emitFor`
        // forwards `additional_context` on the verified `claude` platform — see
        // the hook's file-header proof. This raw tsx spawn bypasses the
        // dispatcher, so the process exit IS the dispatcher-internal code (2),
        // never the host-facing translated code (0).
        expect(r.status, r.stderr).toBe(2);
        const parsed = JSON.parse(r.stdout.trim()) as {
            decision: string;
            additional_context: string;
            reason: string;
        };
        expect(parsed.decision).toBe('warn');
        expect(parsed.additional_context).toBe(buildAdvisoryLine(MUTATION_LINE_THRESHOLD + 20));
        expect(parsed.reason).toContain('end-review-nudge');

        const events = readTelemetryLines(dir);
        expect(events).toHaveLength(1);
        expect(events[0]?.['type']).toBe('note');
        expect(events[0]?.['outcome']).toBe('skipped');
        expect((events[0]?.['review_skipped'] as { diff_lines: number }).diff_lines).toBe(
            MUTATION_LINE_THRESHOLD + 20,
        );
    });

    it('F2: a second Stop event in the SAME session stays silent — the nudge fires once per session', () => {
        const dir = makeRepo();
        mutateCodeFile(dir, MUTATION_LINE_THRESHOLD + 20);
        const first = runHook(dir, envelopeJson(dir));
        expect(first.status, first.stderr).toBe(2);
        expect(readTelemetryLines(dir)).toHaveLength(1);

        // A second Stop event on the SAME session (same session_id baked
        // into `envelopeJson`, same repo) with the SAME qualifying mutation
        // must stay silent — never a repeat injection, never a second
        // telemetry line.
        const second = runHook(dir, envelopeJson(dir));
        expect(second.status, second.stderr).toBe(0);
        expect(second.stdout).toBe('');
        expect(readTelemetryLines(dir)).toHaveLength(1); // still exactly one
    });

    it('F6: a brand-new UNTRACKED file alone (no tracked mutation) crosses the threshold and fires', () => {
        const dir = makeRepo();
        const lines = Array.from(
            { length: MUTATION_LINE_THRESHOLD + 10 },
            (_v, i) => `export const line_${i} = ${i};`,
        );
        fs.writeFileSync(path.join(dir, 'new-module.ts'), `${lines.join('\n')}\n`);
        const r = runHook(dir, envelopeJson(dir));
        expect(r.status, r.stderr).toBe(2);
        const parsed = JSON.parse(r.stdout.trim()) as { additional_context: string };
        expect(parsed.additional_context).toBe(buildAdvisoryLine(MUTATION_LINE_THRESHOLD + 10));
        expect(readTelemetryLines(dir)).toHaveLength(1);
    });

    it('F5: under AGENT_CONFIG_REPLAY=1, fires the advisory but writes neither telemetry nor the session marker', () => {
        const dir = makeRepo();
        mutateCodeFile(dir, MUTATION_LINE_THRESHOLD + 20);
        const r = spawnSync(TSX, [HOOK], {
            encoding: 'utf8',
            cwd: dir,
            input: envelopeJson(dir),
            env: { ...process.env, AGENT_CONFIG_REPLAY: '1' },
        });
        expect(r.status, r.stderr ?? '').toBe(2);
        expect(readTelemetryLines(dir)).toEqual([]);
        expect(fs.existsSync(path.join(dir, 'agents', 'runtime', 'state', 'end-review-nudge'))).toBe(
            false,
        );
    });

    it('doc-only diff (only a .md file changed) → silence, no telemetry', () => {
        const dir = makeRepo();
        mutateDocOnly(dir, 500); // huge by line count, but entirely .md
        const r = runHook(dir, envelopeJson(dir));
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe('');
        expect(readTelemetryLines(dir)).toEqual([]);
    });

    it('reviewer ran this session → silence, no telemetry, even over threshold', () => {
        const dir = makeRepo();
        mutateCodeFile(dir, MUTATION_LINE_THRESHOLD + 20);
        const transcript = writeTranscript(dir, [
            toolUseLine('Bash', { command: 'git status' }),
            toolUseLine('Agent', {
                description: 'blind adversarial review of the diff before claiming done',
            }),
        ]);
        const r = runHook(dir, envelopeJson(dir, transcript));
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe('');
        expect(readTelemetryLines(dir)).toEqual([]);
    });

    it('malformed (non-JSON) stdin in a clean repo → silent exit 0, never crashes', () => {
        const dir = makeRepo(); // no mutation beyond the initial commit
        const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd: dir, input: 'not { json at all' });
        expect(r.status, r.stderr ?? '').toBe(0);
        expect(r.stdout ?? '').toBe('');
        expect(readTelemetryLines(dir)).toEqual([]);
    });

    it('mutation at or below the threshold → silence', () => {
        const dir = makeRepo();
        mutateCodeFile(dir, MUTATION_LINE_THRESHOLD); // exactly at the boundary, not over
        const r = runHook(dir, envelopeJson(dir));
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe('');
        expect(readTelemetryLines(dir)).toEqual([]);
    });

    it('a non-stop event is a strict no-op', () => {
        const dir = makeRepo();
        mutateCodeFile(dir, MUTATION_LINE_THRESHOLD + 20);
        const envelope = JSON.stringify({
            schema_version: 1,
            platform: 'claude',
            event: 'pre_tool_use',
            native_event: 'PreToolUse',
            session_id: 'sess-e2e',
            workspace_root: dir,
            payload: {},
            settings: {},
        });
        const r = runHook(dir, envelope);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe('');
        expect(readTelemetryLines(dir)).toEqual([]);
    });
});
