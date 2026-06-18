// Tests for src/scripts/hooks/dispatch_hook.ts (py2ts Phase 6 — hooks core).
//
// 1:1 port of the pure-parser cases in tests/hooks/test_dispatcher_parser.py
// (_fallback_yaml, _resolve_concerns, _build_envelope, _parse_concern_stdout,
// _severity_for, _reduce, EVENT_VOCABULARY, _maybe_capture_payload). The
// python3-vs-tsx golden-parity layer was retired with the Python→TS final
// deletion (the Python dispatcher no longer exists); end-to-end dispatcher
// behaviour is covered by dispatcher_feedback_traversal.test.ts.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    EVENT_VOCABULARY,
    EXIT_ALLOW,
    EXIT_BLOCK,
    EXIT_WARN,
    _build_envelope,
    _fallback_yaml,
    _load_yaml,
    _maybe_capture_payload,
    _parse_concern_stdout,
    _reduce,
    _resolve_concerns,
    _severity_for,
} from '../../../src/scripts/hooks/dispatch_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

function ns(platform = 'augment', event = 'stop', native = 'Stop') {
    return {
        platform,
        event,
        native_event: native,
        manifest: MANIFEST,
        dry_run: false,
        project_dir: '',
        min_version: 0,
    };
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-hook-'));
    delete process.env['AGENT_HOOK_CAPTURE_DIR'];
});
afterEach(() => {
    delete process.env['AGENT_HOOK_CAPTURE_DIR'];
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
});

// --- _fallback_yaml ---------------------------------------------------

describe('dispatch_hook — _fallback_yaml', () => {
    it('handles lists and scalars', () => {
        const body = [
            '# comment line',
            'schema_version: 1',
            'concerns:',
            '  chat-history:',
            '    script: src/scripts/chat_history.py',
            '    args: [hook-dispatch]',
            '    fail_closed: false',
            'platforms:',
            '  augment:',
            '    session_start: [chat-history]',
            '    stop: []',
            '  copilot:',
            '    fallback_only: true',
            '',
        ].join('\n');
        const parsed = _fallback_yaml(body) as Record<string, any>;
        expect(parsed['schema_version']).toBe(1);
        expect(parsed['concerns']['chat-history']['script']).toBe('src/scripts/chat_history.py');
        expect(parsed['concerns']['chat-history']['args']).toEqual(['hook-dispatch']);
        expect(parsed['concerns']['chat-history']['fail_closed']).toBe(false);
        expect(parsed['platforms']['augment']['session_start']).toEqual(['chat-history']);
        expect(parsed['platforms']['augment']['stop']).toEqual([]);
        expect(parsed['platforms']['copilot']['fallback_only']).toBe(true);
    });

    it('strips quoted scalars', () => {
        expect(_fallback_yaml('key: "quoted-value"\n')).toEqual({ key: 'quoted-value' });
    });
});

// --- _resolve_concerns ------------------------------------------------

const MANIFEST_OBJ = {
    concerns: {
        'chat-history': { script: 'src/scripts/chat_history.py', args: ['hook-dispatch'] },
        'roadmap-progress': { script: 'src/scripts/roadmap_progress_hook.py' },
    },
    platforms: {
        augment: { session_start: ['chat-history'], stop: ['chat-history', 'roadmap-progress'] },
        copilot: { fallback_only: true },
    },
};

describe('dispatch_hook — _resolve_concerns', () => {
    it('returns an ordered list', () => {
        const out = _resolve_concerns(MANIFEST_OBJ as any, 'augment', 'stop');
        expect(out.map((c) => c['name'])).toEqual(['chat-history', 'roadmap-progress']);
        expect(out[0]!['script']).toBe('src/scripts/chat_history.py');
    });
    it('unknown platform yields empty', () => {
        expect(_resolve_concerns(MANIFEST_OBJ as any, 'ghost', 'stop')).toEqual([]);
    });
    it('unknown event yields empty', () => {
        expect(_resolve_concerns(MANIFEST_OBJ as any, 'augment', 'ghost')).toEqual([]);
    });
    it('fallback_only platform yields empty', () => {
        expect(_resolve_concerns(MANIFEST_OBJ as any, 'copilot', 'stop')).toEqual([]);
    });
    it('skips an unknown concern name and warns', () => {
        const errSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        const bad = { concerns: {}, platforms: { augment: { stop: ['missing'] } } };
        expect(_resolve_concerns(bad as any, 'augment', 'stop')).toEqual([]);
        expect(errSpy.mock.calls.map((c) => String(c[0])).join('')).toContain('unknown concern');
    });
});

// --- _build_envelope --------------------------------------------------

describe('dispatch_hook — _build_envelope', () => {
    it('schema + passthrough', () => {
        const env = _build_envelope(ns(), '{"session_id": "abc", "extra": 1}');
        expect(env['schema_version']).toBe(1);
        expect(env['platform']).toBe('augment');
        expect(env['event']).toBe('stop');
        expect(env['native_event']).toBe('Stop');
        expect(env['session_id']).toBe('abc');
        expect(env['payload']).toEqual({ session_id: 'abc', extra: 1 });
        expect(env['settings']).toEqual({});
    });
    it('empty stdin yields empty payload', () => {
        expect(_build_envelope(ns(), '')['payload']).toEqual({});
    });
    it('non-dict payload wrapped', () => {
        expect(_build_envelope(ns(), '"raw-string"')['payload']).toEqual({ _raw: 'raw-string' });
    });
    it('malformed json preserved as raw', () => {
        expect(_build_envelope(ns(), '{not-json')['payload']).toEqual({ _raw: '{not-json' });
    });
});

// --- _parse_concern_stdout / _severity_for / _reduce -----------------

describe('dispatch_hook — stdout/severity/reduce', () => {
    it('parse_concern_stdout variants', () => {
        expect(_parse_concern_stdout('')).toEqual({});
        expect(_parse_concern_stdout('not json')).toEqual({ _raw_stdout: 'not json' });
        expect(_parse_concern_stdout('{"decision": "warn"}')).toEqual({ decision: 'warn' });
        expect(_parse_concern_stdout('[1, 2]')).toEqual({ _raw: [1, 2] });
    });
    it('severity_for', () => {
        expect(_severity_for(0)).toBe('allow');
        expect(_severity_for(1)).toBe('block');
        expect(_severity_for(2)).toBe('warn');
        expect(_severity_for(7)).toBe('error');
    });
    it('reduce: block dominates warn dominates allow', () => {
        expect(_reduce([0, 0, 0])).toBe(EXIT_ALLOW);
        expect(_reduce([0, 2, 0])).toBe(EXIT_WARN);
        expect(_reduce([0, 2, 1])).toBe(EXIT_BLOCK);
        expect(_reduce([])).toBe(EXIT_ALLOW);
    });
});

describe('dispatch_hook — vocabulary', () => {
    it('includes agent_error and session_start', () => {
        expect(EVENT_VOCABULARY.has('agent_error')).toBe(true);
        expect(EVENT_VOCABULARY.has('session_start')).toBe(true);
    });
});

// --- _maybe_capture_payload ------------------------------------------

describe('dispatch_hook — _maybe_capture_payload', () => {
    it('writes when env set', () => {
        process.env['AGENT_HOOK_CAPTURE_DIR'] = tmp;
        _maybe_capture_payload(
            ns('cursor', 'stop', 'stop'),
            '{"hook_event_name": "stop", "session_id": "abc"}',
        );
        const files = fs.readdirSync(tmp).filter((f) => /^cursor__stop__.*\.json$/.test(f));
        expect(files.length).toBe(1);
        const record = JSON.parse(fs.readFileSync(path.join(tmp, files[0]!), 'utf8'));
        expect(record['platform']).toBe('cursor');
        expect(record['event']).toBe('stop');
        expect(record['native_event']).toBe('stop');
        expect(record['raw_payload']['session_id']).toBe('abc');
        expect('captured_at' in record).toBe(true);
    });
    it('silent without env', () => {
        delete process.env['AGENT_HOOK_CAPTURE_DIR'];
        _maybe_capture_payload(ns('cursor', 'stop', 'stop'), '{"x": 1}');
        expect(fs.readdirSync(tmp).filter((f) => f.endsWith('.json'))).toEqual([]);
    });
    it('tolerates invalid json', () => {
        process.env['AGENT_HOOK_CAPTURE_DIR'] = tmp;
        _maybe_capture_payload(ns('windsurf', 'stop', 'post_cascade_response'), 'not-json{garbage');
        const files = fs.readdirSync(tmp).filter((f) => /^windsurf__post_cascade_response__/.test(f));
        expect(files.length).toBe(1);
        const record = JSON.parse(fs.readFileSync(path.join(tmp, files[0]!), 'utf8'));
        expect(record['raw_payload']).toEqual({ _raw_text: 'not-json{garbage' });
    });
    it('creates dir lazily', () => {
        const target = path.join(tmp, 'fresh', 'captures');
        process.env['AGENT_HOOK_CAPTURE_DIR'] = target;
        _maybe_capture_payload(ns('gemini', 'stop', 'AfterAgent'), '{}');
        expect(fs.statSync(target).isDirectory()).toBe(true);
        expect(fs.readdirSync(target).filter((f) => /^gemini__AfterAgent__/.test(f)).length).toBe(1);
    });
});

// --- _load_yaml on the real manifest ---------------------------------

describe('dispatch_hook — _load_yaml', () => {
    it('loads the real manifest with schema_version 1', () => {
        const m = _load_yaml(MANIFEST) as Record<string, unknown>;
        expect(m['schema_version']).toBe(1);
        expect(typeof m['concerns']).toBe('object');
        expect(typeof m['platforms']).toBe('object');
    });
});
