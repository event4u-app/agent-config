/**
 * Independent kill switches for the three session-lifecycle handlers
 * (`road-to-continuity-writer-activation` step 1.4).
 *
 * The step's requirement is not "three keys exist" — it is that disabling ONE
 * restores pre-change behaviour for that handler and leaves the other two
 * firing. So each case throws exactly one switch and asserts all three
 * outcomes, which is the only shape that can fail if the handlers are
 * entangled.
 *
 * Two of the three fire on `stop` inside the `session-eol` concern (the
 * continuity record and the run checkpoint); the third fires on `session_start`
 * (the memory-index restore). The cases therefore drive both slots through the
 * real dispatcher rather than calling any handler directly — an entanglement
 * would live in the wiring, and that is precisely what a unit call cannot see.
 *
 * The proof that the switches are independently READ, rather than that a test
 * happened to pass, is the sensitivity run recorded in the commit: each switch
 * was forced to its opposite value and only its own case went red.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { recycle_envelope_rel } from '../../src/scripts/_lib/recycle_envelope_paths.js';
import { checkpointFile } from '../../src/scripts/_lib/run_checkpoint.js';
import { eolSessionKey } from '../../src/scripts/_lib/session_eol.js';
import { CONTEXT_FILL_REL } from '../../src/scripts/hooks/session_eol_hook.js';
import { roadmap_claim_rel } from '../../src/scripts/session_register_hook.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DISPATCH = path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');

const SLUG = 'road-to-switches-fixture';
const SESSION = 'switches-fixture-session';

const cleanups: string[] = [];
afterEach(() => {
    while (cleanups.length > 0) {
        const d = cleanups.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function writeTranscript(): string {
    const dir = fs.mkdtempSync(path.join(os.homedir(), '.agent-config-sw-test-'));
    cleanups.push(dir);
    const lines: string[] = [];
    for (let i = 0; i < 3; i++) {
        lines.push(JSON.stringify({ type: 'user', message: { role: 'user', content: `p${i}` } }));
        lines.push(
            JSON.stringify({
                type: 'assistant',
                isSidechain: false,
                timestamp: '2026-09-08T10:00:00.000Z',
                message: {
                    role: 'assistant',
                    usage: {
                        input_tokens: 1_000,
                        cache_read_input_tokens: 60_000,
                        cache_creation_input_tokens: 0,
                        output_tokens: 10,
                    },
                },
            }),
        );
    }
    const file = path.join(dir, 'transcript.jsonl');
    fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf-8');
    return file;
}

interface SwitchState {
    auto_record?: 'on' | 'off';
    run_checkpoints?: 'on' | 'off';
    session_index?: 'on' | 'off';
}

/** A workspace with a claimed roadmap and an explicit state for all three switches. */
function writeWorkspace(sw: SwitchState): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cw-switch-ws-')));
    cleanups.push(root);
    const roadmapDir = path.join(root, 'agents', 'roadmaps');
    fs.mkdirSync(roadmapDir, { recursive: true });
    fs.writeFileSync(
        path.join(roadmapDir, `${SLUG}.md`),
        [
            '# Fixture',
            '',
            `${'#'.repeat(2)} Phase 0 — one open step`,
            '',
            '- [x] **0.0** done',
            '- [ ] **0.1** the open one',
            '',
            `${'#'.repeat(2)} Acceptance Criteria`,
            '',
            '- [ ] AC-1 — the switches are independent',
            '',
        ].join('\n'),
        'utf-8',
    );
    const claim = path.join(root, roadmap_claim_rel(SESSION));
    fs.mkdirSync(path.dirname(claim), { recursive: true });
    fs.writeFileSync(claim, JSON.stringify({ slug: SLUG, session_id: SESSION }), 'utf-8');
    fs.writeFileSync(
        path.join(root, '.agent-settings.yml'),
        [
            'continuity:',
            `  auto_record: "${sw.auto_record ?? 'on'}"`,
            `  run_checkpoints: "${sw.run_checkpoints ?? 'on'}"`,
            'memory:',
            `  session_index: "${sw.session_index ?? 'off'}"`,
            '',
        ].join('\n'),
        'utf-8',
    );
    return root;
}

function dispatch(
    event: 'stop' | 'session_start',
    root: string,
    payload: Record<string, unknown>,
): { code: number; out: string } {
    const r = spawnSync(
        'npx',
        [
            'tsx',
            DISPATCH,
            '--platform',
            'claude',
            '--event',
            event,
            '--native-event',
            event === 'stop' ? 'Stop' : 'SessionStart',
            '--project-dir',
            root,
        ],
        {
            input: JSON.stringify({ session_id: SESSION, ...payload }),
            encoding: 'utf-8',
            cwd: REPO,
            timeout: 180_000,
            env: { ...process.env, AGENT_RECYCLE_THRESHOLD_TOKENS: '10000' },
        },
    );
    return { code: r.status ?? -1, out: r.stdout ?? '' };
}

/** The three observable outcomes, one per handler. */
function outcomes(root: string): {
    record: boolean;
    checkpoint: boolean;
    contextFill: boolean;
} {
    return {
        record: fs.existsSync(path.join(root, recycle_envelope_rel(SESSION))),
        checkpoint: fs.existsSync(checkpointFile(root, eolSessionKey(SESSION))),
        contextFill: fs.existsSync(path.join(root, CONTEXT_FILL_REL)),
    };
}

describe('all three armed — the baseline every case below is measured against', () => {
    it('writes the record, the checkpoint and the context-fill surface', () => {
        const root = writeWorkspace({ auto_record: 'on', run_checkpoints: 'on' });
        dispatch('stop', root, { transcript_path: writeTranscript() });
        expect(outcomes(root)).toEqual({ record: true, checkpoint: true, contextFill: true });
    });
});

describe('switch 1 — continuity.auto_record', () => {
    it('off removes the record and leaves the other two handlers firing', () => {
        const root = writeWorkspace({ auto_record: 'off', run_checkpoints: 'on' });
        dispatch('stop', root, { transcript_path: writeTranscript() });
        expect(outcomes(root)).toEqual({ record: false, checkpoint: true, contextFill: true });
    });
});

describe('switch 2 — continuity.run_checkpoints', () => {
    it('off removes the checkpoint and leaves the other two handlers firing', () => {
        const root = writeWorkspace({ auto_record: 'on', run_checkpoints: 'off' });
        dispatch('stop', root, { transcript_path: writeTranscript() });
        expect(outcomes(root)).toEqual({ record: true, checkpoint: false, contextFill: true });
    });

    it('fails OPEN, so an unreadable cascade keeps the recovery aid running', () => {
        const root = writeWorkspace({ auto_record: 'on', run_checkpoints: 'on' });
        // Not YAML. The reader must not read a parse failure as "off" — that
        // would silently remove a recovery aid the tree already had.
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), ':\n  - [\n');
        dispatch('stop', root, { transcript_path: writeTranscript() });
        expect(outcomes(root).checkpoint).toBe(true);
    });

    it('fails CLOSED on the sibling switch, so the same cascade leaves the new producer disarmed', () => {
        const root = writeWorkspace({ auto_record: 'on', run_checkpoints: 'on' });
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), ':\n  - [\n');
        dispatch('stop', root, { transcript_path: writeTranscript() });
        expect(outcomes(root).record).toBe(false);
    });
});

describe('switch 3 — memory.session_index', () => {
    /**
     * What this case claims, narrowed to what it measures.
     *
     * The restore switch reaches `session_start`, a different slot from the
     * other two, so the independence claim here is that throwing it changes
     * NOTHING about the stop-slot handlers — and that its OFF state injects no
     * index. The ON state's injection is deliberately NOT claimed: measured on
     * this fixture, `memory-index` does not appear even with the switch armed,
     * because a scratch workspace carries no curated memory corpus to index.
     * Writing a title that claimed otherwise would be a test asserting a
     * behaviour it never observed.
     *
     * The injection half is covered where a corpus exists:
     * `tests/scripts/session_memory_index.test.ts`.
     */
    it('leaves the stop handlers identical either way, and injects nothing when off', () => {
        const armed = writeWorkspace({ session_index: 'on' });
        dispatch('stop', armed, { transcript_path: writeTranscript() });
        const armedStop = outcomes(armed);
        const armedStart = dispatch('session_start', armed, { source: 'startup' });

        const off = writeWorkspace({ session_index: 'off' });
        dispatch('stop', off, { transcript_path: writeTranscript() });
        const offStop = outcomes(off);
        const offStart = dispatch('session_start', off, { source: 'startup' });

        // The independence claim: a switch on another slot must not reach these.
        expect(armedStop).toEqual({ record: true, checkpoint: true, contextFill: true });
        expect(armedStop).toEqual(offStop);

        // The OFF claim, which does not depend on a corpus existing.
        expect(offStart.out.includes('memory-index')).toBe(false);
        // And the dispatcher completed both runs rather than failing into a
        // vacuous pass.
        expect([0, 2]).toContain(armedStart.code);
        expect([0, 2]).toContain(offStart.code);
    });
});
