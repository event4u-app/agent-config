/**
 * Runtime parity for the deterministic continuity writer — the real dispatcher,
 * the real storage adapter, controlled failures
 * (`road-to-continuity-writer-activation` step 1.3, second half).
 *
 * Why a second file rather than more cases in the unit suite. The unit suite
 * calls `buildContinuityRecord` and `publishContinuityRecord` directly, which
 * pins the transformation and the policy and nothing about the wiring — and the
 * wiring carries the two assumptions that cost the most if they are wrong:
 *
 *   1. **Reachability.** A handler inside `session-eol` runs only if that
 *      concern is bound on the platform's `stop` list and resolvable through
 *      `CONCERN_REGISTRY`. A unit test cannot see either.
 *   2. **Failure isolation.** The step requires that one handler's failure does
 *      not suppress another's. The three handlers share one concern, one
 *      process and one `try` discipline, so the only honest test drives all
 *      three and breaks one on purpose.
 *
 * A wall-clock soak is deliberately absent: both seats of the 2026-09-08
 * council agreed a soak adds nothing a controlled-failure integration test
 * cannot show, and the failures below are injected rather than waited for.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    recycle_consumed_rel,
    recycle_envelope_rel,
} from '../../src/scripts/_lib/recycle_envelope_paths.js';
import { CONTEXT_FILL_REL } from '../../src/scripts/hooks/session_eol_hook.js';
import { roadmap_claim_rel } from '../../src/scripts/session_register_hook.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DISPATCH = path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');

const SLUG = 'road-to-continuity-dispatch-fixture';
const SESSION = 'continuity-dispatch-session';

/**
 * The session that READS what {@link SESSION} wrote. Deliberately a different
 * id, because a record is written for a successor and a session is never
 * handed its own record back — resuming from your own envelope is a loop, not
 * a resume. `dispatch` spreads its payload after the default id, so passing
 * `session_id` overrides it.
 */
const SUCCESSOR = 'continuity-dispatch-successor';
const OTHER = 'a-peer-session';

const cleanups: string[] = [];
afterEach(() => {
    while (cleanups.length > 0) {
        const d = cleanups.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

/**
 * A transcript has to resolve under `os.homedir()` and end in `.jsonl` —
 * `isSafeTranscriptPath` refuses anything else, and a fixture under `/tmp`
 * would make every case here pass for the wrong reason (no transcript → the
 * concern returns before reaching any of its own logic).
 */
function writeTranscript(turns: number, input = 1_000, cacheRead = 60_000): string {
    const dir = fs.mkdtempSync(path.join(os.homedir(), '.agent-config-cw-test-'));
    cleanups.push(dir);
    const lines: string[] = [];
    for (let i = 0; i < turns; i++) {
        lines.push(JSON.stringify({ type: 'user', message: { role: 'user', content: `p${i}` } }));
        lines.push(
            JSON.stringify({
                type: 'assistant',
                isSidechain: false,
                timestamp: '2026-09-08T10:00:00.000Z',
                message: {
                    role: 'assistant',
                    usage: {
                        input_tokens: input,
                        cache_read_input_tokens: cacheRead,
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

/** A workspace with a claimed roadmap and the writer armed unless told otherwise. */
function writeWorkspace(opts: { armed?: boolean; claimed?: boolean } = {}): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cw-dispatch-ws-')));
    cleanups.push(root);
    const roadmapDir = path.join(root, 'agents', 'roadmaps');
    fs.mkdirSync(roadmapDir, { recursive: true });
    fs.writeFileSync(
        path.join(roadmapDir, `${SLUG}.md`),
        [
            '# Fixture',
            '',
            '#'.repeat(2) + ' Phase 0 — one open step',
            '',
            '- [x] **0.0** done',
            '- [ ] **0.1** the open one',
            '',
            '#'.repeat(2) + ' Acceptance Criteria',
            '',
            '- [ ] AC-1 — the record lands',
            '',
        ].join('\n'),
        'utf-8',
    );
    if (opts.claimed !== false) {
        const claim = path.join(root, roadmap_claim_rel(SESSION));
        fs.mkdirSync(path.dirname(claim), { recursive: true });
        fs.writeFileSync(claim, JSON.stringify({ slug: SLUG, session_id: SESSION }), 'utf-8');
    }
    fs.writeFileSync(
        path.join(root, '.agent-settings.yml'),
        `continuity:\n  auto_record: "${opts.armed === false ? 'off' : 'on'}"\n`,
        'utf-8',
    );
    return root;
}

/** Drive the real dispatcher over the real manifest. */
function dispatch(
    event: 'stop' | 'session_start',
    root: string,
    payload: Record<string, unknown>,
    thresholdTokens = 10_000,
): { code: number; out: string; err: string } {
    const nativeEvent = event === 'stop' ? 'Stop' : 'SessionStart';
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
            nativeEvent,
            '--project-dir',
            root,
        ],
        {
            input: JSON.stringify({ session_id: SESSION, ...payload }),
            encoding: 'utf-8',
            cwd: REPO,
            timeout: 180_000,
            env: {
                ...process.env,
                AGENT_RECYCLE_THRESHOLD_TOKENS: String(thresholdTokens),
            },
        },
    );
    return { code: r.status ?? -1, out: r.stdout ?? '', err: r.stderr ?? '' };
}

function stateDir(root: string): string {
    return path.join(root, 'agents', 'runtime', 'state');
}

function records(root: string): string[] {
    const dir = stateDir(root);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter(
            (n) =>
                n.startsWith('recycle-envelope') &&
                n.endsWith('.json') &&
                !n.endsWith('.consumed.json'),
        )
        .sort();
}

function readRecord(root: string): Record<string, unknown> | null {
    const p = path.join(root, recycle_envelope_rel(SESSION));
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
}

function tempLitter(root: string): string[] {
    const dir = stateDir(root);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((n) => n.includes('.tmp.'));
}

describe('activation through the live dispatcher', () => {
    it('publishes exactly one authoritative record, with no temp litter', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);

        const res = dispatch('stop', root, { transcript_path: transcript });
        expect([0, 2]).toContain(res.code);

        expect(records(root)).toHaveLength(1);
        const rec = readRecord(root) as Record<string, unknown>;
        expect(rec['variant']).toBe('continuity_record');
        expect(rec['task']).toBe(SLUG);
        expect(rec['session_id']).toBe(SESSION);
        expect(tempLitter(root)).toEqual([]);
    });

    it('publishes nothing with the switch off, and everything else still runs', () => {
        const root = writeWorkspace({ armed: false });
        const transcript = writeTranscript(3);

        dispatch('stop', root, { transcript_path: transcript });

        expect(records(root)).toEqual([]);
        // The sibling handler in the same concern still did its work, which is
        // what makes this a switch and not an outage.
        expect(fs.existsSync(path.join(root, CONTEXT_FILL_REL))).toBe(true);
    });

    it('publishes nothing when the session claimed no roadmap', () => {
        const root = writeWorkspace({ claimed: false });
        const transcript = writeTranscript(3);

        dispatch('stop', root, { transcript_path: transcript });

        expect(records(root)).toEqual([]);
    });
});

describe('retry safety and the no-overwrite guarantee', () => {
    it('converges on one record across repeated stops rather than accumulating', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);

        dispatch('stop', root, { transcript_path: transcript });
        const first = readRecord(root) as Record<string, unknown>;
        expect(first).not.toBeNull();

        // A second Stop in the same session: the slot policy supersedes.
        dispatch('stop', root, { transcript_path: transcript });
        const second = readRecord(root) as Record<string, unknown>;

        expect(records(root)).toHaveLength(1);
        expect(
            Date.parse(String(second['written_at'])) >= Date.parse(String(first['written_at'])),
        ).toBe(true);
        expect(tempLitter(root)).toEqual([]);
    });

    it('never overwrites a record belonging to another session', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);

        const slot = path.join(root, recycle_envelope_rel(SESSION));
        fs.mkdirSync(path.dirname(slot), { recursive: true });
        const foreign = {
            capsule_version: 4,
            variant: 'continuity_record',
            summary: 'a peer session record',
            task: 'peer-task',
            workspace: root,
            written_at: new Date().toISOString(),
            acceptance_criteria: ['AC-peer'],
            remaining: ['peer step'],
            predecessor: 'none',
            session_id: OTHER,
        };
        fs.writeFileSync(slot, JSON.stringify(foreign, null, 2));
        const before = fs.readFileSync(slot, 'utf-8');

        dispatch('stop', root, { transcript_path: transcript });

        expect(fs.readFileSync(slot, 'utf-8')).toBe(before);
        expect(fs.existsSync(path.join(root, recycle_consumed_rel(SESSION)))).toBe(false);
    });
});

describe('failure isolation across the three handlers in one concern', () => {
    it('a broken context-fill write does not suppress the continuity record', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);

        // A directory where the sibling handler must write a file: its
        // atomic_write_json throws, and the concern swallows it.
        const fill = path.join(root, CONTEXT_FILL_REL);
        fs.mkdirSync(fill, { recursive: true });

        const res = dispatch('stop', root, { transcript_path: transcript });
        expect([0, 2]).toContain(res.code);

        expect(records(root)).toHaveLength(1);
        expect(fs.statSync(fill).isDirectory()).toBe(true);
    });

    it('a genuinely refused continuity publish does not suppress the context-fill write', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);

        // A real refusal, not a nominal one. An unusable resident alone is NOT
        // enough: the slot policy quarantines it by rename and then publishes
        // successfully, so a test that only planted one would assert failure
        // isolation without ever failing. Blocking the quarantine DESTINATION
        // with a directory makes the rename fail, which is the one branch that
        // returns a refusal before any write.
        const slot = path.join(root, recycle_envelope_rel(SESSION));
        fs.mkdirSync(path.dirname(slot), { recursive: true });
        fs.writeFileSync(slot, '{ not a record');
        fs.mkdirSync(`${slot.replace(/\.json$/, '')}.quarantined.json`, { recursive: true });

        const res = dispatch('stop', root, { transcript_path: transcript });
        expect([0, 2]).toContain(res.code);

        // The publish was refused: the unusable resident is still sitting
        // there, untouched, and no record was written over it.
        expect(fs.readFileSync(slot, 'utf-8')).toBe('{ not a record');

        // And the sibling handler in the same concern ran regardless.
        expect(fs.existsSync(path.join(root, CONTEXT_FILL_REL))).toBe(true);
        const fill = JSON.parse(
            fs.readFileSync(path.join(root, CONTEXT_FILL_REL), 'utf-8'),
        ) as Record<string, unknown>;
        expect(fill['schema_version']).toBe(1);
    });
});

describe('source routing on the consumer side', () => {
    it('a startup session_start consumes the record; a resume does not', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);
        dispatch('stop', root, { transcript_path: transcript });
        expect(records(root)).toHaveLength(1);

        // `resume` is not an injecting source: the host is continuing the same
        // conversation, so the record must stay for the session that will
        // actually start clean. Both reads come from the SUCCESSOR's seat —
        // reading under the writer's own id would be refused for a second,
        // unrelated reason and would prove nothing about source routing.
        dispatch('session_start', root, { source: 'resume', session_id: SUCCESSOR });
        expect(records(root)).toHaveLength(1);
        expect(fs.existsSync(path.join(root, recycle_consumed_rel(SUCCESSOR)))).toBe(false);

        dispatch('session_start', root, { source: 'startup', session_id: SUCCESSOR });
        expect(records(root)).toEqual([]);
        expect(fs.existsSync(path.join(root, recycle_consumed_rel(SUCCESSOR)))).toBe(true);
    });
});
