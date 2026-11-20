
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { keepNewerOutcome } from '../../../src/scripts/hooks/feedback_policy.js';
import * as doctor from '../../../src/scripts/hooks_doctor.js';
import { _load_yaml } from '../../../src/scripts/hooks/dispatch_hook.js';
import { MANAGED_SIGNATURE } from '../../../src/scripts/_lib/claude_settings_hooks.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

function loadManifest() {
    return _load_yaml(MANIFEST);
}

let tmp: string;
const DEFAULT_TRAMP = doctor.TRAMPOLINE_DIR;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-doctor-'));
});
afterEach(() => {
    doctor._set_trampoline_dir(DEFAULT_TRAMP);
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('hooks_doctor — collect', () => {
    it('returns every concern declared in the manifest', () => {
        const manifest = loadManifest();
        const payload = doctor.collect(tmp, manifest);
        expect(payload.schema_version).toBe(1);
        const names = new Set(payload.concerns.map((c) => c.concern));
        const expected = new Set(Object.keys((manifest['concerns'] as object) ?? {}));
        expect(names).toEqual(expected);
        for (const c of payload.concerns) {
            expect(typeof c.fail_closed).toBe('boolean');
            expect(c.script).toBeTruthy();
        }
    });

    it('detects trampolines that ship in the package', () => {
        const payload = doctor.collect(tmp, loadManifest());
        const tramp = new Map(payload.trampolines.map((t) => [t.platform, t]));
        for (const p of ['augment', 'cursor', 'cline', 'windsurf', 'gemini', 'cowork']) {
            expect(tramp.get(p)?.present).toBe(true);
            expect(tramp.get(p)?.missing).toBe(false);
        }
        expect(tramp.get('copilot')?.required).toBe(false);
        expect(tramp.get('copilot')?.missing).toBe(false);
    });

    it('flags missing trampolines', () => {
        const fakeDir = path.join(tmp, 'trampolines-empty');
        fs.mkdirSync(fakeDir);
        doctor._set_trampoline_dir(fakeDir);
        const payload = doctor.collect(tmp, loadManifest());
        const tramp = new Map(payload.trampolines.map((t) => [t.platform, t]));
        for (const p of ['augment', 'cursor', 'cline', 'windsurf', 'gemini']) {
            expect(tramp.get(p)?.missing).toBe(true);
        }
        expect(tramp.get('copilot')?.missing).toBe(false);
    });

    it('last_feedback picks the latest session', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const older = path.join(stateDir, 'session-a');
        const newer = path.join(stateDir, 'session-b');
        fs.mkdirSync(older, { recursive: true });
        fs.mkdirSync(newer, { recursive: true });
        fs.writeFileSync(path.join(older, 'chat-history.json'), '{}');
        fs.writeFileSync(path.join(newer, 'chat-history.json'), '{}');
        const past = Date.now() / 1000 - 60;
        fs.utimesSync(path.join(older, 'chat-history.json'), past, past);
        const payload = doctor.collect(tmp, loadManifest());
        const chat = payload.concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback).not.toBeNull();
        expect(chat?.last_feedback?.endsWith(path.join('session-b', 'chat-history.json'))).toBe(true);
    });

    it('last_feedback ranks by the recorded run time: a newer quiet run in a summary beats an older warn file', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const a = path.join(stateDir, 'session-warn');
        const b = path.join(stateDir, 'session-quiet');
        fs.mkdirSync(a, { recursive: true });
        fs.mkdirSync(b, { recursive: true });
        fs.writeFileSync(path.join(a, 'chat-history.json'), JSON.stringify({ concern: 'chat-history', completed_at: '2026-11-20T10:00:00Z' }));
        const summary = path.join(b, 'summary.json');
        fs.writeFileSync(
            summary,
            JSON.stringify({
                schema_version: 2,
                invocations: [
                    { completed_at: '2026-11-20T11:00:00Z', concerns: [{ concern: 'chat-history', exit_code: 0 }] },
                    { completed_at: '2026-11-20T12:00:00Z', concerns: [{ concern: 'other', exit_code: 0 }] },
                ],
            }),
        );
        // The summary's mtime is OLDER than the warn file's: ranking must not use it.
        const past = Date.now() / 1000 - 3600;
        fs.utimesSync(summary, past, past);
        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('session-quiet', 'summary.json'))).toBe(true);
    });

    it('last_feedback ranks a summary by the target concern\'s own last run, not by a later run of another concern', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const a = path.join(stateDir, 'session-warn');
        const b = path.join(stateDir, 'session-quiet');
        fs.mkdirSync(a, { recursive: true });
        fs.mkdirSync(b, { recursive: true });
        // The warn falls BETWEEN the summary's run of chat-history (10:00) and its later run of another concern (12:00).
        fs.writeFileSync(path.join(a, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T11:00:00Z' }));
        fs.writeFileSync(
            path.join(b, 'summary.json'),
            JSON.stringify({
                invocations: [
                    { completed_at: '2026-11-20T10:00:00Z', concerns: [{ concern: 'chat-history' }] },
                    { completed_at: '2026-11-20T12:00:00Z', concerns: [{ concern: 'other' }] },
                ],
            }),
        );
        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('session-warn', 'chat-history.json'))).toBe(true);
    });

    it('last_feedback: a quiet run evicted from the capped history still supersedes an older block, through `latest`', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const sess = path.join(stateDir, 'session-evicted');
        fs.mkdirSync(sess, { recursive: true });
        fs.writeFileSync(path.join(sess, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T10:00:00Z', invocation: 'pid-1', decision: 'block' }));
        fs.writeFileSync(
            path.join(sess, 'summary.json'),
            JSON.stringify({
                // The quiet allow at 11:00 was evicted; only later runs of another concern remain.
                invocations: [{ invocation: 'pid-9', completed_at: '2026-11-20T12:00:00Z', concerns: [{ concern: 'other' }] }],
                latest: {
                    'chat-history': { invocation: 'pid-2', completed_at: '2026-11-20T11:00:00Z', exit_code: 0, decision: 'allow' },
                    other: { invocation: 'pid-9', completed_at: '2026-11-20T12:00:00Z', exit_code: 0, decision: 'allow' },
                },
            }),
        );
        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('session-evicted', 'summary.json'))).toBe(true);
        // The file the doctor points to still says what the latest run was.
        const pointed = JSON.parse(fs.readFileSync(path.join(sess, 'summary.json'), 'utf-8')) as { latest: Record<string, { decision: string }> };
        expect(pointed.latest['chat-history']?.decision).toBe('allow');
    });

    it('last_feedback: one dispatch\'s own file wins over its summary, which records the same run by the same clock in `latest`', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const sess = path.join(stateDir, 'session-one');
        fs.mkdirSync(sess, { recursive: true });
        fs.writeFileSync(path.join(sess, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T10:00:00.100Z', invocation: 'pid-1', decision: 'warn' }));
        fs.writeFileSync(
            path.join(sess, 'summary.json'),
            JSON.stringify({
                // The dispatch-wide completion is later than the concern's own; `latest` uses the concern's.
                invocations: [{ invocation: 'pid-1', completed_at: '2026-11-20T10:00:00.300Z', concerns: [{ concern: 'chat-history' }] }],
                latest: { 'chat-history': { invocation: 'pid-1', completed_at: '2026-11-20T10:00:00.100Z' } },
            }),
        );
        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('session-one', 'chat-history.json'))).toBe(true);
    });

    it('last_feedback: a newer run an older writer left only in the history is not hidden by the first `latest` row', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const sess = path.join(stateDir, 'session-upgrade');
        fs.mkdirSync(sess, { recursive: true });
        // A block file at 11:00; the history (older writer, no `latest`) recorded a quiet run at 12:00;
        // then a delayed 10:00 dispatch on the new writer created the first `latest` row.
        fs.writeFileSync(path.join(sess, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T11:00:00Z', invocation: 'pid-b', decision: 'block' }));
        fs.writeFileSync(
            path.join(sess, 'summary.json'),
            JSON.stringify({
                invocations: [
                    { invocation: 'pid-legacy', completed_at: '2026-11-20T12:00:00Z', concerns: [{ concern: 'chat-history' }] },
                    { invocation: 'pid-late', completed_at: '2026-11-20T10:00:01Z', concerns: [{ concern: 'chat-history' }] },
                ],
                latest: { 'chat-history': { invocation: 'pid-late', completed_at: '2026-11-20T10:00:00Z', exit_code: 0, decision: 'allow' } },
            }),
        );
        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('session-upgrade', 'summary.json'))).toBe(true);
    });

    it('last_feedback ranks a history row by the concern\'s own completion, not by its dispatch finishing later', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const sess = path.join(stateDir, 'session-overlap');
        fs.mkdirSync(sess, { recursive: true });
        // pid-q: a quiet allow completing at 10:00 in a dispatch that finished at 12:00.
        // pid-b: a block completing at 11:00; it owns the `latest` row and the detailed file.
        fs.writeFileSync(path.join(sess, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T11:00:00Z', invocation: 'pid-b', decision: 'block' }));
        fs.writeFileSync(
            path.join(sess, 'summary.json'),
            JSON.stringify({
                invocations: [
                    { invocation: 'pid-b', completed_at: '2026-11-20T11:00:01Z', concerns: [{ concern: 'chat-history', completed_at: '2026-11-20T11:00:00Z' }] },
                    { invocation: 'pid-q', completed_at: '2026-11-20T12:00:00Z', concerns: [{ concern: 'chat-history', completed_at: '2026-11-20T10:00:00Z' }] },
                ],
                latest: { 'chat-history': { invocation: 'pid-b', completed_at: '2026-11-20T11:00:00Z', exit_code: 2, decision: 'block' } },
            }),
        );
        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('session-overlap', 'chat-history.json'))).toBe(true);
    });

    it('last_feedback: an unusable `latest` row does not suppress its dispatch\'s valid history entry', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const sess = path.join(stateDir, 'session-badrow');
        fs.mkdirSync(sess, { recursive: true });
        fs.writeFileSync(path.join(sess, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T11:00:00Z', invocation: 'pid-b', decision: 'block' }));
        fs.writeFileSync(
            path.join(sess, 'summary.json'),
            JSON.stringify({
                invocations: [{ invocation: 'pid-x', completed_at: '2026-11-20T12:00:01Z', concerns: [{ concern: 'chat-history', completed_at: '2026-11-20T12:00:00Z' }] }],
                latest: { 'chat-history': { invocation: 'pid-x', completed_at: 'not a date' } },
            }),
        );
        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('session-badrow', 'summary.json'))).toBe(true);
    });

    for (const [label, row] of [
        ['null', null],
        ['a string', 'x'],
        ['missing its id, though later than everything', { completed_at: '2026-11-20T13:00:00Z' }],
    ] as const) {
        it(`last_feedback: a \`latest\` row that is ${label} is ignored and the history still counts`, () => {
            const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
            const sess = path.join(stateDir, 'session-rows');
            fs.mkdirSync(sess, { recursive: true });
            fs.writeFileSync(path.join(sess, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T11:00:00Z', invocation: 'pid-b', decision: 'block' }));
            fs.writeFileSync(
                path.join(sess, 'summary.json'),
                JSON.stringify({
                    invocations: [{ invocation: 'pid-x', completed_at: '2026-11-20T12:00:01Z', concerns: [{ concern: 'chat-history', completed_at: '2026-11-20T12:00:00Z' }] }],
                    latest: { 'chat-history': row },
                }),
            );
            const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
            expect(chat?.last_feedback?.endsWith(path.join('session-rows', 'summary.json'))).toBe(true);
        });
    }

    it('last_feedback: a row without an id, later than a valid history entry, does not outrank a newer detailed file', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const sess = path.join(stateDir, 'session-noid');
        fs.mkdirSync(sess, { recursive: true });
        fs.writeFileSync(path.join(sess, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T12:30:00Z', invocation: 'pid-b', decision: 'block' }));
        fs.writeFileSync(
            path.join(sess, 'summary.json'),
            JSON.stringify({
                invocations: [{ invocation: 'pid-x', completed_at: '2026-11-20T12:00:01Z', concerns: [{ concern: 'chat-history', completed_at: '2026-11-20T12:00:00Z' }] }],
                latest: { 'chat-history': { completed_at: '2026-11-20T13:00:00Z' } }, // the writer would never keep this row
            }),
        );
        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('session-noid', 'chat-history.json'))).toBe(true);
    });

    it('last_feedback: damaged history items neither hide an accepted `latest` row nor a valid item after them', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const write = (sess: string, latest: unknown, invocations: unknown): void => {
            fs.mkdirSync(path.join(stateDir, sess), { recursive: true });
            fs.writeFileSync(path.join(stateDir, sess, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T11:00:00Z', invocation: 'pid-b', decision: 'block' }));
            fs.writeFileSync(path.join(stateDir, sess, 'summary.json'), JSON.stringify({ invocations, latest }));
        };
        // A newer quiet allow in `latest`; the retained history is damaged.
        write('s1', { 'chat-history': { invocation: 'pid-q', completed_at: '2026-11-20T13:00:00Z', exit_code: 0, decision: 'allow' } }, [null, 'x', { concerns: null }, { concerns: [null, 7] }]);
        let chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('s1', 'summary.json'))).toBe(true);
        fs.rmSync(path.join(stateDir, 's1'), { recursive: true });
        // No `latest`; a valid newer item follows damaged ones, inside the same concerns list too.
        write('s2', undefined, [null, { invocation: 'pid-v', completed_at: '2026-11-20T12:00:01Z', concerns: [null, { concern: 'chat-history', completed_at: '2026-11-20T12:00:00Z' }] }]);
        chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('s2', 'summary.json'))).toBe(true);
        // A non-array history is no history.
        fs.rmSync(path.join(stateDir, 's2'), { recursive: true });
        write('s3', { 'chat-history': { invocation: 'pid-q', completed_at: '2026-11-20T13:00:00Z' } }, { not: 'a list' });
        chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('s3', 'summary.json'))).toBe(true);
    });

    describe('last_feedback on an equal instant', () => {
        const AT = '2026-11-20T10:00:00.000Z';
        const write = (session: string, ownInvocation: string, summaryInvocation: string, summarySession = session): void => {
            const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
            for (const s of new Set([session, summarySession])) fs.mkdirSync(path.join(stateDir, s), { recursive: true });
            fs.writeFileSync(path.join(stateDir, session, 'chat-history.json'), JSON.stringify({ completed_at: AT, invocation: ownInvocation }));
            fs.writeFileSync(
                path.join(stateDir, summarySession, 'summary.json'),
                JSON.stringify({ invocations: [{ invocation: summaryInvocation, completed_at: AT, concerns: [{ concern: 'chat-history' }] }] }),
            );
        };
        const pick = (): string | null | undefined => doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history')?.last_feedback;

        it('the same dispatch: the per-concern file, which holds the detail', () => {
            write('s', 'pid-1', 'pid-1');
            expect(pick()?.endsWith(path.join('s', 'chat-history.json'))).toBe(true);
        });

        // Two dispatches at one instant have no real order; the doctor uses the writers' order
        // (`compareRuns`: the larger invocation id), whichever file the directory walk reads first.
        for (const [own, sum] of [['a-own', 'b-sum'], ['b-own', 'a-sum']] as const) {
            it(`two dispatches, ${own} read ${own < sum ? 'first' : 'second'}: the summary when its id orders later`, () => {
                write(own, 'pid-1', 'pid-2', sum);
                expect(pick()?.endsWith(path.join(sum, 'summary.json'))).toBe(true);
            });
            it(`two dispatches, ${own} read ${own < sum ? 'first' : 'second'}: the per-concern file when its id orders later`, () => {
                write(own, 'pid-2', 'pid-1', sum);
                expect(pick()?.endsWith(path.join(own, 'chat-history.json'))).toBe(true);
            });
        }

        it('agrees with the writer: what the locked keep-newer write left in the file is what the doctor reports', () => {
            // A failed summary write left the older run (pid-2, a block) in the summary; the quiet allow (pid-1)
            // finished in the same millisecond and went to its own file through keepNewerOutcome.
            const held = { decision: 'block', completed_at: AT, invocation: 'pid-2' };
            const incoming = { decision: 'allow', completed_at: AT, invocation: 'pid-1' };
            const kept = keepNewerOutcome(held, incoming) ?? held;
            write('s', String(kept.invocation), 'pid-2');
            const shown = pick();
            // The file keeps the block (pid-2 orders later), and the doctor shows that same run.
            expect(kept.decision).toBe('block');
            expect(shown?.endsWith(path.join('s', 'chat-history.json'))).toBe(true);
        });

        it('a per-concern file from an older writer, with no invocation, does not win a tie', () => {
            write('s', '', 'pid-2');
            const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
            fs.writeFileSync(path.join(stateDir, 's', 'chat-history.json'), JSON.stringify({ completed_at: AT }));
            expect(pick()?.endsWith(path.join('s', 'summary.json'))).toBe(true);
        });
    });

    it('last_feedback compares instants, not strings of different precision', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const a = path.join(stateDir, 'session-a');
        const b = path.join(stateDir, 'session-b');
        fs.mkdirSync(a, { recursive: true });
        fs.mkdirSync(b, { recursive: true });
        // As strings '…10:00:00.500Z' sorts BEFORE '…10:00:00Z'; as instants it is later.
        fs.writeFileSync(path.join(a, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T10:00:00.500Z' }));
        fs.writeFileSync(path.join(b, 'chat-history.json'), JSON.stringify({ completed_at: '2026-11-20T10:00:00Z' }));
        const chat = doctor.collect(tmp, loadManifest()).concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback?.endsWith(path.join('session-a', 'chat-history.json'))).toBe(true);
    });

    it('surfaces the concern state file', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state');
        fs.mkdirSync(stateDir, { recursive: true });
        fs.writeFileSync(path.join(stateDir, 'context-hygiene.json'), '{}');
        const payload = doctor.collect(tmp, loadManifest());
        const ch = payload.concerns.find((c) => c.concern === 'context-hygiene');
        expect(ch?.state_file).toBe(path.join('agents', 'runtime', 'state', 'context-hygiene.json'));
    });
});

describe('hooks_doctor — main / strict', () => {
    it('json format is well-formed', () => {
        const chunks: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string | Uint8Array): boolean => {
            chunks.push(typeof c === 'string' ? c : Buffer.from(c).toString());
            return true;
        }) as typeof process.stdout.write;
        let rc: number;
        try {
            rc = doctor.main(['--format', 'json', '--project-root', tmp]);
        } finally {
            process.stdout.write = orig;
        }
        expect(rc).toBe(0);
        const parsed = JSON.parse(chunks.join(''));
        expect(parsed['schema_version']).toBe(1);
        expect('concerns' in parsed).toBe(true);
        expect('trampolines' in parsed).toBe(true);
        expect('platforms' in parsed).toBe(true);
    });

    it('strict fails on missing bridges', () => {
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = (() => true) as typeof process.stdout.write;
        let rc: number;
        try {
            rc = doctor.main(['--format', 'json', '--project-root', tmp, '--strict']);
        } finally {
            process.stdout.write = orig;
        }
        expect(rc).toBe(1);
    });

    it('strict zero when everything clean', () => {
        const manifest = loadManifest();
        for (const [platform, pair] of Object.entries(doctor.hooks_status.PLATFORM_BRIDGES)) {
            void platform;
            const rel = pair[0];
            if (!rel) continue;
            const bridge = path.join(tmp, rel);
            fs.mkdirSync(path.dirname(bridge), { recursive: true });
            if (rel.endsWith('/hooks')) {
                fs.mkdirSync(bridge, { recursive: true });
                fs.writeFileSync(path.join(bridge, 'placeholder'), '{}');
            } else if (rel === '.claude/settings.json') {
                // Claude's bridge is installed only when it carries a MANAGED hook;
                // an empty settings file is not an install. Before that rule this
                // fixture passed on '{}' alone — and only locally, where a real
                // global install in ~/.claude filled the gap.
                fs.writeFileSync(bridge, JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: `x ${MANAGED_SIGNATURE} --event session_start` }] }] } }));
            } else {
                fs.writeFileSync(bridge, '{}');
            }
        }
        const payload = doctor.collect(tmp, manifest);
        expect(doctor._final_exit_code(payload, true)).toBe(0);
    });
});

describe('obligation ledger section', () => {
    const render = (stats: doctor.ObligationLedgerStats): string =>
        doctor._render_ledger({ obligation_ledger: stats } as doctor.DoctorPayload).join('\n');

    it('prints both lines — writable, and rows this session', () => {
        const out = render({ writable: true, rows_this_session: 7 });
        expect(out).toContain('writable');
        expect(out).toContain('rows this session: 7');
    });

    it('distinguishes zero rows from an unresolvable session', () => {
        // Different answers: 0 means "delivered nothing", null means "cannot
        // tell which session this is". Collapsing them would report a healthy
        // empty ledger for a doctor run that simply had no session to read.
        expect(render({ writable: true, rows_this_session: 0 })).toContain(
            'rows this session: 0',
        );
        const noSession = render({ writable: true, rows_this_session: null });
        expect(noSession).toContain('no session id resolved');
        expect(noSession).not.toContain('rows this session: 0');
    });

    it('marks an unwritable ledger with the failure marker, not the success one', () => {
        const out = render({ writable: false, rows_this_session: null });
        expect(out).toContain('❌ ');
        expect(out).not.toContain('✅ ');
    });

    it('always states that a row is not compliance evidence', () => {
        // The council lock this ledger sits under forbids exactly that reading,
        // so the disclaimer is not decoration — it is the section's contract.
        for (const stats of [
            { writable: true, rows_this_session: 12 },
            { writable: false, rows_this_session: null },
        ]) {
            expect(render(stats)).toContain('not evidence that a rule');
        }
    });

    it('reports an unwritable root as unwritable without throwing', () => {
        const wall = path.join(tmp, 'wall');
        fs.writeFileSync(wall, 'not a directory');
        expect(() => doctor.collectLedgerStats(wall)).not.toThrow();
        expect(doctor.collectLedgerStats(wall).writable).toBe(false);
    });

    it('reports a usable root as writable and leaves no probe behind', () => {
        const stats = doctor.collectLedgerStats(tmp);
        expect(stats.writable).toBe(true);
        const dir = path.join(tmp, 'agents', 'runtime', 'state', 'obligations');
        const left = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        expect(left.filter((f) => f.includes('writable-probe'))).toEqual([]);
    });
});
