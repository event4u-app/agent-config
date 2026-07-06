// Tests for src/scripts/capture_showcase_session.ts (py2ts Phase 8 / Wave 8g).
//
// 1:1 port of tests/test_capture_showcase_session.py — the four metric
// functions, the frontmatter emitter, _split_body, and the capture/metrics
// CLI subcommands. Plus intent tests on the `metrics` CLI subcommand with a
// fixed body — deterministic (metrics emits neither `commit_sha` nor
// timestamps), so outputs are asserted directly.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    _computeMetrics,
    _metricMemoryHitRatio,
    _metricReplyChars,
    _metricToolCallCount,
    _metricVerifyPassRate,
    _renderFrontmatter,
    _setSessionsDir,
    _splitBody,
    FloatTag,
    main,
} from '../../src/scripts/capture_showcase_session.js';
import { runTs } from './_wave8g.js';

const SAMPLE_BODY = `## User
Implement feature X.

## Agent
Working on it now.

<tool_use name="view">{"path": "foo.py"}</tool_use>

memory_retrieve hits=3 misses=1

Done — feature X is complete.

## User
das passt nicht, missing tests.

## Agent
Sorry, adding tests now.

<tool_use name="save-file">{"path":"foo_test.py"}</tool_use>

Ready for review.
`;

const tmp: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'css8g-'));
    tmp.push(d);
    return d;
}
afterEach(() => {
    while (tmp.length) {
        fs.rmSync(tmp.pop() as string, { recursive: true, force: true });
    }
});

describe('capture_showcase_session — metric functions (1:1 port)', () => {
    it('tool_call_count counts tool_use blocks', () => {
        expect(_metricToolCallCount(SAMPLE_BODY)).toBe(2);
    });
    it('tool_call_count zero when empty', () => {
        expect(_metricToolCallCount('')).toBe(0);
    });
    it('reply_chars returns mean across agent turns', () => {
        const mean = _metricReplyChars(SAMPLE_BODY);
        expect(mean).not.toBeNull();
        expect(mean as number).toBeGreaterThan(0);
    });
    it('reply_chars returns a number when no split', () => {
        expect(_metricReplyChars('just some text')).not.toBeNull();
    });
    it('memory_hit_ratio uses visibility-v1 format', () => {
        const [ratio, notes] = _metricMemoryHitRatio(SAMPLE_BODY);
        expect(ratio).toBe(0.75);
        expect(notes).toEqual([]);
    });
    it('memory_hit_ratio none when no calls', () => {
        const [ratio, notes] = _metricMemoryHitRatio('plain text');
        expect(ratio).toBeNull();
        expect(notes).toContain('no memory_retrieve calls found');
    });
    it('verify_pass_rate handles correction', () => {
        const [ratio] = _metricVerifyPassRate(SAMPLE_BODY);
        expect(ratio).toBe(0.5);
    });
    it('verify_pass_rate none without done-claims', () => {
        const [ratio, notes] = _metricVerifyPassRate('## User\nhi\n\n## Agent\nhello');
        expect(ratio).toBeNull();
        expect(notes.some((n) => n.includes('done-claim'))).toBe(true);
    });
    it('_split_body strips existing frontmatter', () => {
        expect(_splitBody('---\nslug: x\n---\nbody here')).toBe('body here');
    });
    it('_split_body passes through when no frontmatter', () => {
        expect(_splitBody('body only')).toBe('body only');
    });
    it('_render_frontmatter emits valid YAML shape', () => {
        // Mirror python {"slug": "demo", "metrics": {"tool_call_count": 3,
        // "reply_chars_mean": 250.0}} — 250.0 is a float → FloatTag.
        const fm = _renderFrontmatter({
            slug: 'demo',
            metrics: { tool_call_count: 3, reply_chars_mean: new FloatTag(250.0) },
        });
        expect(fm.startsWith('---\n')).toBe(true);
        expect(fm.trimEnd().endsWith('---')).toBe(true);
        expect(fm.includes('"demo"')).toBe(true);
        expect(fm.includes('tool_call_count: 3')).toBe(true);
    });
});

describe('capture_showcase_session — capture subcommand (1:1 port)', () => {
    it('capture writes session with frontmatter', () => {
        const d = mkTmp();
        _setSessionsDir(path.join(d, 'sessions'));
        const src = path.join(d, 'raw.log');
        fs.writeFileSync(src, SAMPLE_BODY, 'utf-8');
        const rc = main([
            'capture',
            '--input',
            src,
            '--slug',
            'test_session',
            '--task-class',
            'implement-ticket',
            '--host',
            'augment',
            '--model',
            'test-model',
            '--force',
        ]);
        expect(rc).toBe(0);
        const out = fs.readFileSync(path.join(d, 'sessions', 'test_session.log'), 'utf-8');
        expect(out.startsWith('---\n')).toBe(true);
        expect(out.includes('tool_call_count: 2')).toBe(true);
        expect(out.includes('## User')).toBe(true);
    });
});

describe('capture_showcase_session — metrics CLI (tsx)', () => {
    function sessionFile(): string {
        const d = mkTmp();
        const s = path.join(d, 'x.log');
        fs.writeFileSync(s, SAMPLE_BODY, 'utf-8');
        return s;
    }

    it('metrics --format json emits the four metrics with python-style float repr', () => {
        const s = sessionFile();
        const r = runTs('capture_showcase_session', ['metrics', '--session', s, '--format', 'json']);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        expect(JSON.parse(r.stdout)).toEqual({
            tool_call_count: 2,
            reply_chars_mean: 120.0,
            memory_hit_ratio: 0.75,
            verify_pass_rate: 0.5,
        });
        // Floats keep the python-compat ".0" repr on the wire.
        expect(r.stdout).toContain('"reply_chars_mean": 120.0');
    });

    it('metrics text table lists all four metrics', () => {
        const s = sessionFile();
        const r = runTs('capture_showcase_session', ['metrics', '--session', s]);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        expect(r.stdout).toMatch(/^ {2}tool-call-count\s+2$/m);
        expect(r.stdout).toMatch(/^ {2}reply-chars\s+120\.0$/m);
        expect(r.stdout).toMatch(/^ {2}memory-hit-ratio\s+0\.75$/m);
        expect(r.stdout).toMatch(/^ {2}verify-pass-rate\s+0\.5$/m);
        expect(r.stdout.trimEnd().split('\n')).toHaveLength(4);
    });

    it('metrics single float metric (reply-chars) in text and json', () => {
        const s = sessionFile();
        const text = runTs('capture_showcase_session', ['metrics', '--session', s, '--metric', 'reply-chars', '--format', 'text']);
        expect(text.status).toBe(0);
        expect(text.stdout).toMatch(/^ {2}reply-chars\s+120\.0\n$/);
        const json = runTs('capture_showcase_session', ['metrics', '--session', s, '--metric', 'reply-chars', '--format', 'json']);
        expect(json.status).toBe(0);
        expect(JSON.parse(json.stdout)).toEqual({ 'reply-chars': 120.0 });
        expect(json.stdout).toContain('"reply-chars": 120.0');
    });

    // NOTE: `capture` writes to the fixed live path docs/showcase/sessions/.
    // Exercising capture via the CLI would mutate the tracked tree, so the
    // capture write path is covered by the unit test above (via
    // _setSessionsDir into os.tmpdir()); only the deterministic `metrics`
    // surface is exercised through the spawned CLI.
});
