/**
 * road-to-a-fill-the-session-sees-coming 2.2 — after `/clear` the continuity
 * record is handed over as a pointer and a digest, never as its body. The user
 * cleared to get a small context back; re-injecting the whole record undoes
 * part of that, and the file stays readable at the pointer.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { consume_recycle_envelope, recordDelivery } from '../../src/scripts/handoff_context_hook.js';
import { CAPSULE_SCHEMA_VERSION } from '../../src/scripts/_lib/subagent_capsule.js';
import { recycle_consumed_rel, recycle_envelope_rel } from '../../src/scripts/_lib/recycle_envelope_paths.js';

const BODY_MARKER = 'diff bodies are never carried — a sentence only the body contains';

function envelope(root: string): Record<string, unknown> {
    return {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'main_session',
        summary: 'road-to-x: 3 of 7 steps closed',
        task: 'road-to-x',
        workspace: root,
        written_at: new Date().toISOString(),
        acceptance_criteria: ['every phase step is closed'],
        remaining: ['wire the doctor row', 'drop the estimate'],
        not_carried_forward: [BODY_MARKER],
        failed_approaches: ['none'],
        successful_approaches: ['none'],
        predecessor: 'none',
    };
}

let root: string;
beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'clear-pointer-')));
    const target = path.join(root, recycle_envelope_rel('peer-session'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(envelope(root), null, 2));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('recordDelivery — which shape each source gets', () => {
    it('clear gets the pointer; startup and an absent source keep the body', () => {
        expect(recordDelivery('clear')).toBe('pointer');
        expect(recordDelivery('startup')).toBe('body');
        expect(recordDelivery('')).toBe('body');
    });
});

describe('consume_recycle_envelope in pointer mode', () => {
    it('emits the pointer and digest, and no body', () => {
        const d = consume_recycle_envelope(root, new Date(), 'reader-session', 'pointer');
        expect(d.action).toBe('inject');
        const ctx = String(d.context);
        const consumed = recycle_consumed_rel('reader-session');
        expect(ctx).toContain(`"pointer": "${path.join(path.dirname(recycle_envelope_rel('peer-session')), path.basename(consumed))}"`);
        expect(ctx).toContain('road-to-x: 3 of 7 steps closed');
        expect(ctx).toContain('"next": "wire the doctor row"');
        expect(ctx).toContain('"remaining_count": 2');
        expect(ctx).toMatch(/"sha256": "[0-9a-f]{12}"/);
        expect(ctx).not.toContain(BODY_MARKER);
        expect(ctx).not.toContain('acceptance_criteria');
    });

    it('the file the pointer names exists and still holds the full body', () => {
        const d = consume_recycle_envelope(root, new Date(), 'reader-session', 'pointer');
        const pointer = /"pointer": "([^"]+)"/.exec(String(d.context))?.[1];
        expect(pointer).toBeDefined();
        expect(fs.readFileSync(path.join(root, pointer!), 'utf-8')).toContain(BODY_MARKER);
    });

    it('body mode is unchanged and still carries the body', () => {
        const d = consume_recycle_envelope(root, new Date(), 'reader-session');
        expect(String(d.context)).toContain(BODY_MARKER);
    });
});
