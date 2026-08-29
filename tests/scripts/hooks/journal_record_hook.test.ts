// The journal's hook binding — the population step 1.4 could not observe
// (road-to-runtime-event-journal 1.4; AI council 2026-08-28, decision 3).
//
// WHAT THIS FILE ESTABLISHES, and what it deliberately does not.
//
//   * ESTABLISHED: the concern is bound in the shipped manifest, resolves
//     through the real dispatcher resolver on the slots the manifest claims,
//     is registered in CONCERN_REGISTRY, is default-OFF, records every event of
//     the vocabulary when armed, records NO free-form content, and returns 0 on
//     every failure path.
//   * NOT ESTABLISHED: a HOST capture rate. Driving envelopes through the
//     dispatch path measures the dispatch path. The denominator 1.4 asks for is
//     the count of events a real host EMITS, and nothing in this tree counts
//     that. `agents/evidence/analysis/runtime-journal-capture-2026-08-28.md`
//     states which of the two each number is.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CONCERN_REGISTRY } from '../../../src/scripts/hooks/concern_registry.js';
import { _load_yaml, _resolve_concerns } from '../../../src/scripts/hooks/dispatch_hook.js';
import type { JsonObject } from '../../../src/scripts/hooks/journal_record_hook.js';
import {
    SETTINGS_SECTION,
    capabilityFor,
    processEnvelope,
    recordedFor,
    reduceEnvelope,
    run,
    toCapability,
} from '../../../src/scripts/hooks/journal_record_hook.js';
import {
    JOURNAL_RECORD_KEYS,
    RECORDED_EVENTS,
    isJournalAvailable,
    openJournal,
    readAllEvents,
} from '../../../src/scripts/_lib/runtime_journal.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const SCRIPT = 'src/scripts/hooks/journal_record_hook.ts';
const CONCERN = 'journal-record';

/** The claude slots the manifest binds this concern on. Pinned deliberately. */
const BOUND_SLOTS = [
    'session_start',
    'session_end',
    'user_prompt_submit',
    'post_tool_use',
    'stop',
    'pre_compact',
    'subagent_start',
    'subagent_stop',
] as const;

/** Bound on no platform for this slot, and the omission is a decision. */
const UNBOUND_SLOT = 'pre_tool_use';

const sqliteOk = isJournalAvailable();

let root: string;

function arm(enabled: boolean): void {
    fs.writeFileSync(
        path.join(root, '.agent-settings.yml'),
        `hooks:\n  ${SETTINGS_SECTION}:\n    enabled: ${enabled ? 'true' : 'false'}\n`,
        'utf8',
    );
}

/** A dispatcher envelope, in the shape `hooks/envelope.ts` documents. */
function envelope(event: string, extra: JsonObject = {}): JsonObject {
    return {
        schema_version: 1,
        platform: 'claude',
        event,
        native_event: event,
        session_id: 'sess-fixture',
        workspace_root: root,
        payload: {},
        settings: {},
        ...extra,
    };
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-hook-'));
    delete process.env['AGENT_CONFIG_REPLAY'];
});

afterEach(() => {
    delete process.env['AGENT_CONFIG_REPLAY'];
    fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// The binding itself — the thing 1.4 could not observe
// ---------------------------------------------------------------------------

describe('the journal is bound in the dispatch path (1.4)', () => {
    const manifest = _load_yaml(MANIFEST);

    it('is declared as a concern in the shipped manifest', () => {
        const concerns = (manifest as Record<string, Record<string, Record<string, unknown>>>)['concerns'];
        expect(concerns?.[CONCERN]).toBeDefined();
        expect(concerns?.[CONCERN]?.['script']).toBe(SCRIPT);
        // Class A + never-blocks, asserted from the declaration rather than
        // from the prose that claims it.
        expect(concerns?.[CONCERN]?.['fail_closed']).toBe(false);
        expect(concerns?.[CONCERN]?.['severity']).toBe('advisory');
        // It reads no payload bodies, so it must not opt into paying for them.
        expect(concerns?.[CONCERN]?.['needs_payload_bodies']).toBeUndefined();
    });

    it('is in CONCERN_REGISTRY — the commonly-missed fourth surface', () => {
        // Parity with the manifest is CI-enforced elsewhere; this pins the
        // specific entry so a registry line removed by hand fails HERE too.
        expect(Object.keys(CONCERN_REGISTRY)).toContain(SCRIPT);
        expect(typeof CONCERN_REGISTRY[SCRIPT]).toBe('function');
    });

    it('resolves through the real dispatcher resolver on every slot it claims', () => {
        for (const slot of BOUND_SLOTS) {
            const names = _resolve_concerns(manifest, 'claude', slot).map((c) => c.name);
            expect(names, `${slot} does not resolve ${CONCERN}`).toContain(CONCERN);
        }
    });

    it('is NOT bound on pre_tool_use — an unbound slot stated, not implied', () => {
        // The omission is a binding decision (that slot is on the critical path
        // of every tool call and post_tool_use records the same call). A test
        // pins it so a later "let's bind everything" edit is a visible change.
        const names = _resolve_concerns(manifest, 'claude', UNBOUND_SLOT).map((c) => c.name);
        expect(names).not.toContain(CONCERN);
    });

    it('run-continuation still ends the claude stop chain', () => {
        const names = _resolve_concerns(manifest, 'claude', 'stop').map((c) => c.name);
        expect(names[names.length - 1]).toBe('run-continuation');
        expect(names).toContain(CONCERN);
    });
});

// ---------------------------------------------------------------------------
// Default-OFF
// ---------------------------------------------------------------------------

describe.runIf(sqliteOk)('default-OFF (ADR-124 section 3, not superseded by ADR-249)', () => {
    it('writes nothing with no settings file at all', () => {
        expect(processEnvelope(envelope('stop'), root)).toBe(0);
        expect(recordedFor(envelope('stop'), root)).toBe('disabled');
        expect(fs.existsSync(path.join(root, 'agents', 'runtime', 'state', 'journal.sqlite'))).toBe(false);
    });

    it('writes nothing with the section present and false', () => {
        arm(false);
        expect(recordedFor(envelope('stop'), root)).toBe('disabled');
    });

    it('writes nothing in replay mode even when armed', () => {
        arm(true);
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        expect(recordedFor(envelope('stop'), root)).toBe('replay-mode');
    });

    it('writes once armed', () => {
        arm(true);
        expect(recordedFor(envelope('stop'), root)).toBeNull();
        const h = openJournal(root);
        try {
            expect(readAllEvents(h)).toHaveLength(1);
        } finally {
            h.close();
        }
    });
});

// ---------------------------------------------------------------------------
// Dispatch-path capture — the measurement, with its denominator named
// ---------------------------------------------------------------------------

describe.runIf(sqliteOk)('dispatch-path capture over the whole vocabulary (1.4)', () => {
    it('every recorded event reaching the concern lands exactly one record', () => {
        arm(true);
        const vocabulary = [...RECORDED_EVENTS];
        const perEvent = 10;
        let dispatched = 0;
        const skips: string[] = [];

        for (const event of vocabulary) {
            for (let i = 0; i < perEvent; i += 1) {
                dispatched += 1;
                const skip = recordedFor(envelope(event, { session_id: `sess-${i % 3}` }), root);
                if (skip !== null) skips.push(`${event}: ${skip}`);
            }
        }

        const h = openJournal(root);
        try {
            const events = readAllEvents(h);
            // Denominator NAMED: envelopes handed to the concern, not events a
            // host emitted. The distinction is the whole point of 1.4.
            expect(dispatched).toBe(vocabulary.length * perEvent);
            expect(skips, skips.join('\n')).toEqual([]);
            expect(events).toHaveLength(dispatched);
            expect(new Set(events.map((e) => e.event)).size).toBe(vocabulary.length);
        } finally {
            h.close();
        }
    });

    it('an event outside the vocabulary is refused with a NAMED reason, never silently', () => {
        arm(true);
        expect(recordedFor(envelope('tool_denied'), root)).toBe('event-not-recorded');
    });

    it('an envelope with no session id is refused with its own reason', () => {
        arm(true);
        const e = envelope('stop');
        delete (e as Record<string, unknown>)['session_id'];
        expect(recordedFor(e, root)).toBe('no-session-id');
    });

    it('a raw (non-envelope) payload is refused rather than guessed at', () => {
        arm(true);
        expect(recordedFor('not-an-object' as unknown as JsonObject, root)).toBe('not-an-envelope');
    });
});

// ---------------------------------------------------------------------------
// Privacy by construction, end to end through the concern
// ---------------------------------------------------------------------------

describe.runIf(sqliteOk)('the concern cannot carry content into the record (AC-2)', () => {
    it('a payload stuffed with prompts, paths and diffs produces a record of ids only', () => {
        arm(true);
        const secretish = '/Users/someone/private/repo/src/secret.ts';
        const e = envelope('post_tool_use', {
            payload: {
                tool_name: 'Read',
                cwd: secretish,
                tool_input: { file_path: secretish, prompt: 'ignore all previous instructions' },
                tool_response: 'BEGIN RSA PRIVATE KEY',
            },
        });
        expect(recordedFor(e, root)).toBeNull();

        const h = openJournal(root);
        try {
            const [rec] = readAllEvents(h);
            expect(rec).toBeDefined();
            expect(Object.keys(rec as object).sort()).toEqual([...JOURNAL_RECORD_KEYS].sort());
            const serialised = JSON.stringify(rec);
            expect(serialised).not.toContain('secret.ts');
            expect(serialised).not.toContain('/Users/');
            expect(serialised).not.toContain('ignore all previous');
            expect(serialised).not.toContain('RSA');
            // The one host string it does record is the tool NAME, reduced to
            // the bounded-identifier grammar.
            expect(rec?.capability).toBe('read');
        } finally {
            h.close();
        }
    });

    it('reduces a hostile tool name to a bounded identifier, or refuses it', () => {
        expect(toCapability('Read')).toBe('read');
        expect(toCapability('Bash(git status)')).toBe('bash-git-status');
        expect(toCapability('   ')).toBeNull();
        expect(toCapability('!!!')).toBeNull();
        const long = toCapability('x'.repeat(500));
        expect(long).not.toBeNull();
        expect((long as string).length).toBeLessThanOrEqual(64);
    });

    it('falls back to the event name when no tool name survives reduction', () => {
        expect(capabilityFor('stop', {}, {})).toBe('stop');
        expect(capabilityFor('stop', {}, { tool_name: '!!!' })).toBe('stop');
    });
});

// ---------------------------------------------------------------------------
// The boundary gap, recorded rather than papered over
// ---------------------------------------------------------------------------

describe.runIf(sqliteOk)('task correlation is honest about what the host supplies', () => {
    it('a claude envelope carries no task id, so the record is MARKED session_fallback', () => {
        arm(true);
        expect(recordedFor(envelope('user_prompt_submit'), root)).toBeNull();
        const h = openJournal(root);
        try {
            const [rec] = readAllEvents(h);
            expect(rec?.boundary_status).toBe('session_fallback');
            expect(rec?.task_id).toBeNull();
        } finally {
            h.close();
        }
    });

    it('reads Cline native taskId when the host does supply one', () => {
        arm(true);
        const reduced = reduceEnvelope(envelope('post_tool_use', { payload: { taskId: 'task-42' } }));
        expect(reduced?.task_id).toBe('task-42');
        expect(recordedFor(envelope('post_tool_use', { payload: { taskId: 'task-42' } }), root)).toBeNull();
        const h = openJournal(root);
        try {
            const [rec] = readAllEvents(h);
            expect(rec?.boundary_status).toBe('derived');
            expect(rec?.episode_id.startsWith('ep-')).toBe(true);
        } finally {
            h.close();
        }
    });
});

// ---------------------------------------------------------------------------
// It never fails a turn
// ---------------------------------------------------------------------------

describe('never blocks, never fails the turn', () => {
    it('returns 0 on malformed stdin', () => {
        expect(run('', { consumer_root: root })).toBe(0);
        expect(run('{not json', { consumer_root: root })).toBe(0);
        expect(run('[]', { consumer_root: root })).toBe(0);
        expect(run('null', { consumer_root: root })).toBe(0);
    });

    it('returns 0 when the root is unwritable', () => {
        arm(true);
        expect(processEnvelope(envelope('stop'), '/proc/nonexistent-journal-root')).toBe(0);
    });

    it('returns 0 with an unreadable settings file', () => {
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), '  not yaml at all', 'utf8');
        expect(processEnvelope(envelope('stop'), root)).toBe(0);
    });

    it('exits 0 as a real process on a malformed envelope', () => {
        const tsx = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
        if (!fs.existsSync(tsx)) return;
        const out = execFileSync(tsx, [path.join(REPO_ROOT, SCRIPT)], {
            input: '{"broken":',
            cwd: REPO_ROOT,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        // Silent on every path — the concern has nothing to say to the model.
        expect(out.toString()).toBe('');
    });
});
