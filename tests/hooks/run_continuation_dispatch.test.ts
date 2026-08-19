/**
 * run_continuation through the LIVE dispatcher — road-to-long-horizon-execution
 * Phase 1.2, the half its unit suite could not cover.
 *
 * Why a second test file rather than more cases in the unit suite.
 *
 * `tests/scripts/hooks/run_continuation.test.ts` calls `ladder()`,
 * `scanOpenSteps()` and `refusedThisTurn()` directly. That pins the decision
 * logic and nothing about the wiring — and the wiring is where this concern's
 * two most expensive assumptions live:
 *
 *   1. **Chain order.** The defer branch reads `turn-end-gate`'s refusal marker
 *      off disk and calls itself "race-free by chain order: concerns run
 *      sequentially and this concern is registered after the gate". A unit test
 *      cannot see the chain. If the manifest ever lists `run-continuation`
 *      before `turn-end-gate`, every unit test still passes and the concern
 *      re-engages turns the gate refused.
 *   2. **Reachability.** A concern reaches the in-process path only via
 *      `CONCERN_REGISTRY`. This concern shipped WITHOUT its registry line, and
 *      no unit test noticed — the parity test did, which is the same lesson
 *      from the other direction: the unit suite proves the function, the
 *      integration proves it runs.
 *
 * So this file drives the real `dispatch_hook` binary over the real manifest
 * with a real stop envelope, and asserts the two things only that can show.
 *
 * Honest scope: it does NOT make `turn-end-gate` itself refuse. Doing that
 * needs the gate's own trigger conditions, and the assertion here is about the
 * ORDER and the READ, not about the gate's detection. The marker is written
 * exactly as the gate writes it, via the gate's own module.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { deriveSessionKey, sessionRefusalFile } from '../../src/scripts/_lib/turn_end_refusals.js';
import { roadmap_claim_rel } from '../../src/scripts/session_register_hook.js';
import { EVENTS_RELPATH } from '../../src/scripts/hooks/run_continuation_hook.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MANIFEST = path.join(REPO, 'src', 'scripts', 'hook_manifest.yaml');

const SLUG = 'road-to-lh-dispatch-fixture';
const SESSION = 'lh-dispatch-fixture-session';

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
 * concern returns ALLOW before reaching any of its own logic).
 */
function writeTranscript(userTurns: number): string {
    const dir = fs.mkdtempSync(path.join(os.homedir(), '.agent-config-lh-test-'));
    cleanups.push(dir);
    const lines: string[] = [];
    for (let i = 0; i < userTurns; i++) {
        lines.push(JSON.stringify({ type: 'user', message: { content: `prompt ${i}` } }));
        lines.push(JSON.stringify({ type: 'assistant', message: { content: 'reply' } }));
    }
    const file = path.join(dir, 'transcript.jsonl');
    fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf-8');
    return file;
}

/** A workspace carrying a claimed, autonomous roadmap with one open step. */
function writeWorkspace(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-dispatch-ws-'));
    cleanups.push(root);
    const roadmapDir = path.join(root, 'agents', 'roadmaps');
    fs.mkdirSync(roadmapDir, { recursive: true });
    fs.writeFileSync(
        path.join(roadmapDir, `${SLUG}.md`),
        [
            '---',
            'complexity: structural',
            'execution:',
            '  mode: autonomous',
            '---',
            '',
            '# Fixture',
            '',
            '## Phase 0 — one open step',
            '',
            '- [x] **0.0** done',
            '- [ ] **0.1** the open one <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->',
            '',
        ].join('\n'),
        'utf-8',
    );
    const claim = path.join(root, roadmap_claim_rel(SESSION));
    fs.mkdirSync(path.dirname(claim), { recursive: true });
    fs.writeFileSync(claim, JSON.stringify({ slug: SLUG, session_id: SESSION }), 'utf-8');
    return root;
}

/** Drive the real dispatcher over the real manifest for a claude `stop`. */
function dispatchStop(
    root: string,
    transcript: string,
): { code: number; err: string; out: string } {
    const r = spawnSync(
        'npx',
        [
            'tsx',
            path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts'),
            '--platform',
            'claude',
            '--event',
            'stop',
            '--native-event',
            'Stop',
            '--project-dir',
            root,
        ],
        {
            input: JSON.stringify({ session_id: SESSION, transcript_path: transcript }),
            encoding: 'utf-8',
            cwd: REPO,
            timeout: 180_000,
        },
    );
    return { code: r.status ?? -1, err: r.stderr ?? '', out: r.stdout ?? '' };
}

function events(root: string): Array<Record<string, unknown>> {
    const file = path.join(root, EVENTS_RELPATH);
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf-8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('run-continuation — chain order in the shipped manifest', () => {
    // The race-freedom claim in `refusedThisTurn`'s docblock is a claim about
    // THIS list. Asserted against the manifest rather than trusted from a
    // comment, because a reordering is a one-line edit that breaks the concern
    // silently and passes every unit test.
    it('is registered strictly after turn-end-gate on the claude stop chain', () => {
        const doc = parseYaml(fs.readFileSync(MANIFEST, 'utf8')) as {
            platforms?: Record<string, Record<string, string[]>>;
        };
        const chain = doc.platforms?.['claude']?.['stop'];
        expect(chain).toBeDefined();
        const gate = (chain as string[]).indexOf('turn-end-gate');
        const cont = (chain as string[]).indexOf('run-continuation');
        expect(gate).toBeGreaterThanOrEqual(0);
        expect(cont).toBeGreaterThanOrEqual(0);
        expect(cont).toBeGreaterThan(gate);
    });

    it('is LAST on that chain — nothing may run after the continuation decision', () => {
        const doc = parseYaml(fs.readFileSync(MANIFEST, 'utf8')) as {
            platforms?: Record<string, Record<string, string[]>>;
        };
        const chain = doc.platforms?.['claude']?.['stop'] as string[];
        expect(chain[chain.length - 1]).toBe('run-continuation');
    });
});

describe('run-continuation — driven through the live dispatcher', () => {
    it('engages on an autonomous claimed roadmap with an open step', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);
        const res = dispatchStop(root, transcript);
        const log = events(root);
        // Two assertions, and the second one exists because its absence hid a
        // critical defect. The event log proves the concern was REACHED and
        // decided; the exit code proves the decision REACHED THE HOST. The
        // original version of this test asserted only the first and said so
        // deliberately — that pinning an exit code would make it "a claim about
        // Claude's protocol". It is exactly that claim, and it is the one worth
        // making: the concern shipped `severity: advisory`, the dispatcher's
        // severity ceiling downgraded its EXIT_BLOCK to WARN, and stop+warn maps
        // to exit 0. The concern ran, logged `engage`, injected its text as
        // context — and did not stop the stop. Every assertion below passed the
        // whole time.
        expect(log.length).toBeGreaterThan(0);
        const engaged = log.filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        expect(engaged[0]?.['roadmap']).toBe(SLUG);
        expect(engaged[0]?.['open']).toBe(1);

        // The continuation names the next step AND its verify line — a bare
        // "keep going" is the anti-pattern the harvest section rejects. It is
        // asserted on the dispatcher's OUTPUT rather than in the event log,
        // because the log records that an engagement happened and its counts,
        // never the text injected. Two different questions: the ledger answers
        // "how often did this fire", the output answers "what did the agent
        // actually receive", and only the second one can catch a degenerate
        // continuation.
        const seen = `${res.out}${res.err}`;
        expect(seen).toContain('0.1');
        expect(seen).toContain('lint_hook_manifest');
        expect(res.code).not.toBe(-1);
        // exit 2 is the ONLY value that makes Claude Code refuse the Stop and
        // feed the reason back to the model (`host_semantics.emitFor`, stop is
        // block-capable). exit 0 here means the continuation was delivered as
        // passive context on a turn that ended anyway — the inert shape.
        expect(res.code).toBe(2);
    });

    it('DEFERS when turn-end-gate refused this turn — the quality gate always wins', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);
        // Written through the gate's own module, at the ordinal this transcript
        // yields (3 genuine user turns → ordinal 3), so the shape cannot drift
        // from what the gate actually writes.
        const marker = sessionRefusalFile(root, deriveSessionKey(SESSION));
        fs.mkdirSync(path.dirname(marker), { recursive: true });
        // The full `RefusalRecord` shape, not just `refused_turn`: `parseRecord`
        // requires `refused_at` and a valid `detector` too and returns null
        // otherwise — a partial fixture reads as "never refused" and the test
        // would pass for the wrong reason on the engage branch.
        fs.writeFileSync(
            marker,
            JSON.stringify({
                refused_at: '2026-08-19T00:00:00.000Z',
                refused_turn: 3,
                detector: 'verification',
            }),
            'utf-8',
        );

        dispatchStop(root, transcript);
        const log = events(root);
        expect(log.some((e) => e['event'] === 'deferred-quality-gate')).toBe(true);
        // And it did NOT also engage: a defer that still emits a continuation
        // would override the refusal it was supposed to respect.
        expect(log.some((e) => e['event'] === 'engage')).toBe(false);
    });

    it('does not engage without a claim — the contract gate is the hard requirement', () => {
        const root = writeWorkspace();
        fs.rmSync(path.join(root, roadmap_claim_rel(SESSION)));
        const transcript = writeTranscript(3);
        dispatchStop(root, transcript);
        expect(events(root)).toEqual([]);
    });

    it('does not engage when the roadmap is not autonomous', () => {
        const root = writeWorkspace();
        const roadmap = path.join(root, 'agents', 'roadmaps', `${SLUG}.md`);
        fs.writeFileSync(
            roadmap,
            fs.readFileSync(roadmap, 'utf-8').replace('mode: autonomous', 'mode: phase-checkpoints'),
            'utf-8',
        );
        const transcript = writeTranscript(3);
        dispatchStop(root, transcript);
        expect(events(root)).toEqual([]);
    });

    it('the kill switch silences it through the whole chain', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);
        const r = spawnSync(
            'npx',
            [
                'tsx',
                path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts'),
                '--platform',
                'claude',
                '--event',
                'stop',
                '--native-event',
                'Stop',
                '--project-dir',
                root,
            ],
            {
                input: JSON.stringify({ session_id: SESSION, transcript_path: transcript }),
                encoding: 'utf-8',
                cwd: REPO,
                timeout: 180_000,
                env: { ...process.env, AGENT_CONFIG_NO_RUN_CONTINUATION: '1' },
            },
        );
        expect(r.status ?? -1).not.toBe(-1);
        expect(events(root)).toEqual([]);
    });
});
