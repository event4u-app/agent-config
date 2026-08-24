import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    LATCH_REL,
    LATCH_TTL_MS,
    RECORD_KEYS,
    SINK_REL,
    appendRecord,
    classify,
    classifyTurn,
    consumeLatch,
    detectBlock,
    enabled,
    main as hookMain,
    writeLatch,
    type Latch,
} from '../../src/scripts/hooks/suggestion_capture_hook';
import { CONCERN_REGISTRY } from '../../src/scripts/hooks/concern_registry';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin';

let root: string;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sugg-capture-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const latch = (over: Partial<Latch> = {}): Latch => ({
    prompt_id: 'p1',
    options_count: 3,
    at: Date.now(),
    ...over,
});

describe('the render signature', () => {
    const block = [
        'Two ways to do this.',
        '',
        '1. Run the command as written',
        '2. Route through the skill',
        '3. Leave it as-is',
        '',
        '**Recommendation: 2** — the skill carries the gate.',
    ].join('\n');

    it('detects a real block and counts its options', () => {
        expect(detectBlock(block)).toEqual({ emitted: true, optionsCount: 3 });
    });

    it('detects the German label, because a wrong-language label is a rule violation', () => {
        expect(detectBlock(block.replace('Recommendation:', 'Empfehlung:')).emitted).toBe(true);
    });

    it('refuses a numbered list with no recommendation line — that is ordinary prose', () => {
        expect(detectBlock('1. first\n2. second\n3. third').emitted).toBe(false);
    });

    it('refuses a recommendation line with no options — that is a sentence', () => {
        expect(detectBlock('Recommendation: use the skill.').emitted).toBe(false);
    });

    it('refuses TWO recommendation lines — the single-source Iron Law makes that malformed', () => {
        expect(detectBlock(`${block}\nRecommendation: 1 — no, this one.`).emitted).toBe(false);
    });

    it('refuses a single option — one choice is not a choice', () => {
        expect(detectBlock('1. only this\n\nRecommendation: 1 — go.').emitted).toBe(false);
    });

    it('is empty-safe', () => {
        expect(detectBlock('')).toEqual({ emitted: false, optionsCount: 0 });
    });
});

describe('classification of the answering turn', () => {
    it('a bare number in range is a pick', () => {
        for (const t of ['2', '2.', '2)', ' 2 ']) expect(classify(t, 3)).toBe('option_n');
    });

    it('a number OUT of range is not a pick — it is answering something else', () => {
        expect(classify('7', 3)).toBe('other');
    });

    it('a number followed by an instruction is NOT a pick', () => {
        // Counting `1. do the thing` would inflate the very rate this measures.
        expect(classify('1. rename the helper', 3)).toBe('other');
    });

    it('as-is is matched by intent, in both languages', () => {
        for (const t of ['as-is', 'as is please', 'unverändert', 'leave it', 'keep it', 'so lassen'])
            expect(classify(t, 3)).toBe('as_is');
    });

    it('ordinary prose is other', () => {
        expect(classify('actually, use the other approach', 3)).toBe('other');
    });

    it('an empty prompt is other, never a pick', () => {
        expect(classify('   ', 3)).toBe('other');
    });
});

describe('the latch is consumed exactly once — the misclassification guard', () => {
    it('a second read after consumption finds nothing', () => {
        writeLatch(root, latch());
        expect(consumeLatch(root)).not.toBeNull();
        expect(consumeLatch(root)).toBeNull();
        expect(fs.existsSync(path.join(root, LATCH_REL))).toBe(false);
    });

    it('a bare number with NO latch is other, never a pick', () => {
        const v = classifyTurn('2', null, Date.now());
        expect(v.turn_classification).toBe('other');
        // And nothing is written: recording every ordinary turn would make the
        // sink a prompt log with the volume of one.
        expect(v.record).toBe(false);
        expect(v.evidence_class).toBe('no-latch');
    });

    it('a latch past its TTL is stale_block, not a pick', () => {
        const now = Date.now();
        const v = classifyTurn('2', latch({ at: now - LATCH_TTL_MS - 1 }), now);
        expect(v.turn_classification).toBe('stale_block');
        expect(v.evidence_class).toBe('latch-stale');
        expect(v.record).toBe(true);
    });

    it('an UNPARSEABLE latch reads as absent, never as a guess', () => {
        const p = path.join(root, LATCH_REL);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, '{not json', 'utf8');
        expect(consumeLatch(root)).toBeNull();
    });

    it('a latch missing a required field reads as absent', () => {
        const p = path.join(root, LATCH_REL);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify({ prompt_id: 'x' }), 'utf8');
        expect(consumeLatch(root)).toBeNull();
    });

    it('all four enum outcomes are reachable', () => {
        const now = Date.now();
        const got = new Set([
            classifyTurn('2', latch(), now).turn_classification,
            classifyTurn('as-is', latch(), now).turn_classification,
            classifyTurn('something else', latch(), now).turn_classification,
            classifyTurn('2', latch({ at: now - LATCH_TTL_MS - 1 }), now).turn_classification,
        ]);
        expect([...got].sort()).toEqual(['as_is', 'option_n', 'other', 'stale_block']);
    });
});

describe('the record carries counts and nothing else', () => {
    it('the written key set is exactly what the schema registers', () => {
        appendRecord(
            root,
            {
                ts: '',
                block_emitted: true,
                options_count: 3,
                evidence_class: 'latch-consumed',
                turn_classification: 'option_n',
            },
            new Date('2026-08-24T10:11:12.345Z'),
        );
        const lines = fs.readFileSync(path.join(root, SINK_REL), 'utf8').trim().split('\n');
        expect(lines).toHaveLength(1);
        const rec = JSON.parse(lines[0] as string) as Record<string, unknown>;
        // An ADDED field fails here rather than shipping quietly — which is what
        // makes the counts-only claim a checked property and not a promise.
        expect(Object.keys(rec).sort()).toEqual([...RECORD_KEYS].sort());
        expect(rec['ts']).toBe('2026-08-24T10:11:12Z');
    });

    it('the schema config and the writer agree on the field set', () => {
        const cfg = JSON.parse(fs.readFileSync(path.join('src', 'config', 'suggestion-capture.json'), 'utf8')) as {
            record_fields: Record<string, string>;
            classification_enum: string[];
            evidence_class_enum: string[];
        };
        expect(Object.keys(cfg.record_fields).sort()).toEqual([...RECORD_KEYS].sort());
        expect(cfg.classification_enum.sort()).toEqual(['as_is', 'option_n', 'other', 'stale_block']);
        expect(cfg.evidence_class_enum.sort()).toEqual([
            'latch-consumed',
            'latch-stale',
            'no-latch',
            'render-signature',
        ]);
    });

    it('no registered field name can carry content', () => {
        for (const k of RECORD_KEYS) expect(k).not.toMatch(/prompt|text|content|label|message/i);
    });
});

describe('default-OFF', () => {
    it('absent settings file → disabled', () => {
        expect(enabled(root)).toBe(false);
    });

    it('section present but not enabled → disabled', () => {
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), 'hooks:\n  suggestion_capture:\n    enabled: false\n');
        expect(enabled(root)).toBe(false);
    });

    it('enabled: true under the right section → enabled', () => {
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), 'hooks:\n  suggestion_capture:\n    enabled: true\n');
        expect(enabled(root)).toBe(true);
    });

    it('enabled: true under a DIFFERENT hooks section does not arm this one', () => {
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), 'hooks:\n  code_graph:\n    enabled: true\n');
        expect(enabled(root)).toBe(false);
    });

    it('enabled: true outside hooks: entirely does not arm it', () => {
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), 'telemetry:\n  suggestion_capture:\n    enabled: true\n');
        expect(enabled(root)).toBe(false);
    });
});

describe('the probe finding this design rests on is recorded', () => {
    const probe = fs.readFileSync(
        path.join('agents', 'evidence', 'analysis', 'suggestion-capture-probe.md'),
        'utf8',
    );

    it('records that stop carries last_assistant_message', () => {
        expect(probe).toContain('last_assistant_message');
    });

    it('records the turn-1 blind spot the two-slot shape avoids', () => {
        expect(probe).toContain('file exists, turn 1');
    });

    it('scopes the probe to one host rather than generalising', () => {
        expect(probe).toContain('covers Claude Code only');
    });
});

/**
 * The entry point the DISPATCHER calls — the one surface the 30 tests above
 * never touched, and the reason a silent no-op shipped.
 *
 * Every test above imports a pure helper. `main` was reachable only through a
 * live dispatch, so nothing noticed that its first parameter was a `Date` while
 * `_run_concern_inproc` passes `argv`. `now.getTime()` threw on every real turn
 * and the instrument's own "never break the turn" catch swallowed it, leaving
 * exit 0 and no output — indistinguishable from a disabled hook.
 *
 * These cases go through `CONCERN_REGISTRY`, which is the exact object the
 * dispatcher indexes, so the call shape under test is the production one rather
 * than a convenient one.
 */
describe('main() under the dispatcher call shape', () => {
    const SCRIPT = 'src/scripts/hooks/suggestion_capture_hook.ts';
    const BLOCK =
        'Two ways forward.\n\n1. Option one\n2. Option two\n3. Run as-is\n\n' +
        '**Recommendation: 1** — smallest change.\n';

    function envelope(event: string, native: string, payload: Record<string, unknown>): string {
        return JSON.stringify({
            schema_version: 1,
            platform: 'claude',
            event,
            native_event: native,
            session_id: 's1',
            workspace_root: root,
            payload,
            settings: {},
        });
    }

    function enable(): void {
        fs.writeFileSync(
            path.join(root, '.agent-settings.yml'),
            'hooks:\n  suggestion_capture:\n    enabled: true\n',
        );
    }

    afterEach(() => {
        clearHookStdinOverride();
    });

    it('CONCERN_REGISTRY holds this concern under its manifest script path', () => {
        expect(typeof CONCERN_REGISTRY[SCRIPT]).toBe('function');
    });

    it('a stop turn called with ARGV — not a Date — writes the latch', () => {
        // The regression. Before the fix this threw inside the concern, was
        // swallowed, and returned EXIT_ALLOW with no latch on disk.
        enable();
        setHookStdinOverride(
            envelope('stop', 'Stop', {
                hook_event_name: 'Stop',
                cwd: root,
                prompt_id: 'p1',
                last_assistant_message: BLOCK,
            }),
        );
        const rc = CONCERN_REGISTRY[SCRIPT]!(['--platform', 'claude']);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(root, LATCH_REL))).toBe(true);
    });

    it('the following prompt turn consumes the latch and appends exactly one record', () => {
        enable();
        setHookStdinOverride(
            envelope('stop', 'Stop', {
                hook_event_name: 'Stop',
                cwd: root,
                prompt_id: 'p1',
                last_assistant_message: BLOCK,
            }),
        );
        CONCERN_REGISTRY[SCRIPT]!(['--platform', 'claude']);
        setHookStdinOverride(
            envelope('user_prompt_submit', 'UserPromptSubmit', {
                hook_event_name: 'UserPromptSubmit',
                cwd: root,
                prompt_id: 'p2',
                prompt: '1',
            }),
        );
        expect(CONCERN_REGISTRY[SCRIPT]!(['--platform', 'claude'])).toBe(0);
        expect(fs.existsSync(path.join(root, LATCH_REL))).toBe(false);
        const lines = fs
            .readFileSync(path.join(root, SINK_REL), 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean);
        expect(lines).toHaveLength(1);
        const rec = JSON.parse(lines[0]!) as Record<string, unknown>;
        expect(Object.keys(rec).sort()).toEqual([...RECORD_KEYS].sort());
        expect(rec['evidence_class']).toBe('latch-consumed');
        expect(rec['turn_classification']).toBe('option_n');
        expect(rec['options_count']).toBe(3);
    });

    it('an ordinary turn with no preceding block writes nothing at all', () => {
        enable();
        setHookStdinOverride(
            envelope('user_prompt_submit', 'UserPromptSubmit', {
                hook_event_name: 'UserPromptSubmit',
                cwd: root,
                prompt_id: 'p9',
                prompt: 'please refactor the auth module',
            }),
        );
        expect(CONCERN_REGISTRY[SCRIPT]!(['--platform', 'claude'])).toBe(0);
        expect(fs.existsSync(path.join(root, SINK_REL))).toBe(false);
    });

    it('the injectable clock is the SECOND parameter, so a stale latch is still reachable', () => {
        // Proves the fix did not simply delete the seam the TTL tests need.
        enable();
        writeLatch(root, { prompt_id: 'p1', options_count: 2, at: 0 });
        setHookStdinOverride(
            envelope('user_prompt_submit', 'UserPromptSubmit', {
                hook_event_name: 'UserPromptSubmit',
                cwd: root,
                prompt_id: 'p2',
                prompt: '1',
            }),
        );
        expect(hookMain([], new Date(LATCH_TTL_MS + 60_000))).toBe(0);
        const rec = JSON.parse(
            fs.readFileSync(path.join(root, SINK_REL), 'utf8').trim(),
        ) as Record<string, unknown>;
        expect(rec['evidence_class']).toBe('latch-stale');
        expect(rec['turn_classification']).toBe('stale_block');
    });

    it('disabled settings keep it silent even with a block on the wire', () => {
        // No .agent-settings.yml written: default-OFF must hold through main().
        setHookStdinOverride(
            envelope('stop', 'Stop', {
                hook_event_name: 'Stop',
                cwd: root,
                prompt_id: 'p1',
                last_assistant_message: BLOCK,
            }),
        );
        expect(CONCERN_REGISTRY[SCRIPT]!(['--platform', 'claude'])).toBe(0);
        expect(fs.existsSync(path.join(root, LATCH_REL))).toBe(false);
    });
});
