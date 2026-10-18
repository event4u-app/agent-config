import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { classifyInstructionsLoaded, hostVersionFromEnv, type ObserverLine } from '../../src/scripts/_lib/instructions_loaded_classify.js';
import { captureInstructionsLoaded } from '../../src/scripts/_lib/instructions_loaded_event.js';
import {
    arrivalEvidence,
    arrivalReceipts,
    buildArrivalRecord,
    latestArrivalRecord,
    readObserverLines,
    validateArrivalRecord,
} from '../../src/scripts/_lib/arrival_record.js';
import { rungState } from '../../src/scripts/_lib/activation_ladder.js';
import { processEnvelope, arrivalsDir, KEEP_SESSIONS, KILL_SWITCH_ENV, MAX_SESSION_BYTES } from '../../src/scripts/hooks/instructions_observer_hook.js';
import { lastObserverError, recordsIn, renderRecord } from '../../src/scripts/arrival_report.js';

const HOME = '/home/dev';
const ENV = { AI_AGENT: 'claude-code_2-1-299_agent', CLAUDE_CODE_ENTRYPOINT: 'cli' } as NodeJS.ProcessEnv;

let tick = 0;
function line(payload: unknown): ObserverLine {
    tick += 1;
    return classifyInstructionsLoaded(payload, { ts: `2026-10-18T00:00:${String(tick).padStart(2, '0')}Z`, home: HOME, env: ENV });
}

function load(file: string, reason = 'session_start', session = 's1'): ObserverLine {
    return line({ session_id: session, hook_event_name: 'InstructionsLoaded', file_path: file, load_reason: reason });
}

const USER_RULE = (id: string) => `${HOME}/.claude/rules/${id}.md`;

describe('classifyInstructionsLoaded', () => {
    it('keeps the basename and a scope enum, never the path', () => {
        const l = load(USER_RULE('scope-control'));
        expect(l).toMatchObject({ event: 'loaded', file: 'scope-control.md', kind: 'rule', scope: 'user', reason: 'session_start', host_version: '2.1.299', launch: 'cli' });
        expect(JSON.stringify(l)).not.toContain('/home/dev');
    });

    it('reads a project rule and a CLAUDE.md', () => {
        expect(load('/repo/.claude/rules/x.md')).toMatchObject({ kind: 'rule', scope: 'project' });
        expect(load('/repo/CLAUDE.md')).toMatchObject({ kind: 'memory', scope: 'project' });
    });

    it('records every payload it cannot read as unknown', () => {
        expect(line('not an object')).toMatchObject({ event: 'unknown', session: null });
        expect(line({ session_id: 's1', hook_event_name: 'Stop' })).toMatchObject({ event: 'unknown', why: 'event-mismatch' });
        expect(line({ hook_event_name: 'InstructionsLoaded', session_id: 's1', load_reason: 'session_start' })).toMatchObject({ event: 'unknown', why: 'no-file-path' });
        expect(line({ hook_event_name: 'InstructionsLoaded', session_id: 's1', file_path: USER_RULE('a'), load_reason: 'telepathy' })).toMatchObject({ event: 'unknown', why: 'unknown-load-reason' });
    });

    it('fails closed on a missing event name and on a path that is not absolute and canonical', () => {
        expect(line({ session_id: 's1', file_path: USER_RULE('a'), load_reason: 'session_start' })).toMatchObject({ why: 'event-mismatch' });
        const ok = { hook_event_name: 'InstructionsLoaded', session_id: 's1', load_reason: 'session_start' };
        for (const file_path of ['.claude/rules/a.md', `${HOME}/x/../.claude/rules/a.md`, `${HOME}/./.claude/rules/a.md`, `${HOME}//.claude/rules/a.md`]) {
            expect(line({ ...ok, file_path }), file_path).toMatchObject({ event: 'unknown', why: 'no-file-path' });
        }
    });

    it('a line with every field at its maximum length stays under 2 KiB', () => {
        const t = 'a'.repeat(128);
        const capture = captureInstructionsLoaded(
            { hook_event_name: t, session_id: t, load_reason: t, file_path: `/${t}/${t}` },
            new Date().toISOString(),
            HOME,
            { AI_AGENT: t, CLAUDE_CODE_ENTRYPOINT: t },
        );
        expect(Buffer.byteLength(JSON.stringify(capture))).toBeLessThan(2048);
    });

    it('parses the host version only from the documented agent string', () => {
        expect(hostVersionFromEnv({ AI_AGENT: 'claude-code_2-1-302_agent' })).toBe('2.1.302');
        expect(hostVersionFromEnv({ AI_AGENT: 'cursor' })).toBeNull();
        expect(hostVersionFromEnv({})).toBeNull();
    });
});

describe('the arrival record and its negative controls (step 1.2)', () => {
    it('one clean session yields one visible record', () => {
        const r = buildArrivalRecord([load(USER_RULE('a')), load(USER_RULE('b')), load(USER_RULE('a'), 'compact')], 's1');
        expect(r.status).toBe('visible');
        expect(r.files.map((f) => f.file)).toEqual(['a.md', 'b.md', 'a.md']);
        expect(r.dispatcher_reached).toBe(true);
        expect(validateArrivalRecord(r)).toEqual([]);
    });

    const controls: Record<string, ObserverLine[]> = {
        'event unavailable on the host version': [],
        'malformed payload': [load(USER_RULE('a')), line({ session_id: 's1', file_path: 7 })],
        'duplicate call': [load(USER_RULE('a')), load(USER_RULE('a'))],
        'start-up events lost: no session-start load at all': [load(USER_RULE('a'), 'compact')],
    };
    for (const [name, lines] of Object.entries(controls)) {
        it(`${name} → unknown, never an arrival`, () => {
            const r = buildArrivalRecord(lines, 's1');
            expect(r.status).toBe('unknown');
            expect(arrivalEvidence(r, new Set(['a']))).toBeNull();
        });
    }

    it('events reordered → the same record as in order; order can neither create nor remove an arrival', () => {
        // The host runs this hook asynchronously, so disk order is scheduler order.
        const ordered = [load(USER_RULE('a')), load(USER_RULE('b')), load(USER_RULE('c'), 'path_glob_match')];
        const shuffled = [ordered[2]!, ordered[0]!, ordered[1]!];
        const norm = (r: ReturnType<typeof buildArrivalRecord>) => ({ ...r, files: [...r.files].sort((x, y) => (x.file < y.file ? -1 : 1)) });
        expect(norm(buildArrivalRecord(shuffled, 's1'))).toEqual(norm(buildArrivalRecord(ordered, 's1')));
        expect(buildArrivalRecord([ordered[2]!], 's1').status, 'only a lazy load arrived').toBe('unknown');
    });

    it('a session mixing host versions is unknown', () => {
        const other = classifyInstructionsLoaded(
            { hook_event_name: 'InstructionsLoaded', session_id: 's1', file_path: USER_RULE('b'), load_reason: 'session_start' },
            { ts: '2026-10-18T00:01:00Z', home: HOME, env: { AI_AGENT: 'claude-code_2-1-300_agent' } },
        );
        expect(buildArrivalRecord([load(USER_RULE('a')), other], 's1').unknown_reason).toBe('host-version-mixed');
    });

    it('lines of another session do not leak in', () => {
        const r = buildArrivalRecord([load(USER_RULE('a'), 'session_start', 's2')], 's1');
        expect(r.unknown_reason).toBe('event-unavailable');
    });
});

describe('the record schema', () => {
    it('rejects a body or a prompt field anywhere', () => {
        const r = buildArrivalRecord([load(USER_RULE('a'))], 's1');
        expect(validateArrivalRecord({ ...r, body: 'x' })).toEqual(['record: field `body` is not part of the record']);
        expect(validateArrivalRecord({ ...r, files: [{ ...r.files[0], prompt: 'p' }] })).toEqual([
            'files[0]: field `prompt` is not part of the record',
        ]);
        expect(validateArrivalRecord({ ...r, files: [{ ...r.files[0], file: '/home/dev/x.md' }] })).toHaveLength(1);
    });
});

describe('evidence for the layer-form decision', () => {
    it('reports the standing-law set as loaded only when every member loaded at session start', () => {
        const r = buildArrivalRecord([load(USER_RULE('a')), load(USER_RULE('b')), load(USER_RULE('c'), 'path_glob_match')], 's1');
        expect(arrivalEvidence(r, new Set(['a', 'b']))).toEqual({ hostVersion: '2.1.299', stubsLoaded: true, standingLawsLoaded: true });
        expect(arrivalEvidence(r, new Set(['a', 'c']))?.standingLawsLoaded).toBe(false);
    });

    it('a project-scope load is not evidence about the installed layer', () => {
        const r = buildArrivalRecord([load('/repo/.claude/rules/a.md')], 's1');
        expect(arrivalEvidence(r, new Set(['a']))).toEqual({ hostVersion: '2.1.299', stubsLoaded: false, standingLawsLoaded: false });
    });
});

describe('activation_ladder maps the record to `visible`', () => {
    it('reached, not-reached, and unknown for an unknown record', () => {
        const r = buildArrivalRecord([load(USER_RULE('a'))], 's1');
        const [a, b] = arrivalReceipts(r, ['a', 'b']);
        expect(rungState(a!, 'visible')).toBe('reached');
        expect(rungState(b!, 'visible')).toBe('not-reached');
        const u = buildArrivalRecord([], 's1');
        expect(rungState(arrivalReceipts(u, ['a'])[0]!, 'visible')).toBe('unknown');
    });
});

describe('the observer concern', () => {
    let root: string;
    let env: NodeJS.ProcessEnv;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'arrivals-'));
        env = { ...ENV, HOME, EVENT4U_CONFIG_HOME: root };
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    const envelope = (payload: Record<string, unknown>) =>
        JSON.stringify({
            schema_version: 1,
            platform: 'claude',
            event: 'instructions_loaded',
            payload: { hook_event_name: 'InstructionsLoaded', ...payload },
        });

    it('appends one line per event to its session file, and a record can be built from the directory', () => {
        expect(processEnvelope(envelope({ session_id: 's9', file_path: USER_RULE('a'), load_reason: 'session_start' }), env)).toBe(0);
        expect(processEnvelope('{not json', env)).toBe(0);
        expect(fs.readdirSync(arrivalsDir(env))).toEqual(['s9.jsonl']);
        expect((fs.statSync(path.join(arrivalsDir(env), 's9.jsonl')).mode & 0o777).toString(8)).toBe('600');
        const lines = readObserverLines(arrivalsDir(env));
        expect(lines).toHaveLength(1);
        expect(latestArrivalRecord(lines)?.status).toBe('visible');
    });

    it('keeps only the newest sessions when a new one starts', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < KEEP_SESSIONS + 5; i += 1) {
            const f = path.join(dir, `old-${String(i)}.jsonl`);
            fs.writeFileSync(f, '', { mode: 0o600 });
            fs.utimesSync(f, 1_000 + i, 1_000 + i);
        }
        processEnvelope(envelope({ session_id: 'new', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        const left = fs.readdirSync(dir);
        expect(left).toHaveLength(KEEP_SESSIONS);
        expect(left).toContain('new.jsonl');
        expect(left).not.toContain('old-0.jsonl');
    });

    it('the kill switch writes nothing', () => {
        processEnvelope(envelope({ session_id: 's9', file_path: USER_RULE('a'), load_reason: 'session_start' }), { ...env, [KILL_SWITCH_ENV]: 'off' });
        expect(fs.existsSync(arrivalsDir(env))).toBe(false);
    });

    it('an envelope carrying another event is classified, not trusted: an unknown line', () => {
        processEnvelope(JSON.stringify({ event: 'stop', payload: { session_id: 'x', hook_event_name: 'Stop' } }), env);
        expect(readObserverLines(arrivalsDir(env))).toMatchObject([{ event: 'unknown', why: 'event-mismatch' }]);
    });

    it('a hostile session id never names a file outside the directory', () => {
        for (const sid of ['../escape', '..', '/abs', 'a/b', '.hidden']) {
            processEnvelope(envelope({ session_id: sid, file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        }
        expect(fs.readdirSync(root), 'nothing is written for an id that is not id-shaped').toEqual([]);
    });

    it('a session file stops growing at its cap', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'big.jsonl'), 'x'.repeat(MAX_SESSION_BYTES + 1), { mode: 0o600 });
        processEnvelope(envelope({ session_id: 'big', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.statSync(path.join(dir, 'big.jsonl')).size).toBe(MAX_SESSION_BYTES + 1);
    });

    it('sixty sessions leave exactly the newest fifty, ties broken by name', () => {
        for (let i = 0; i < 60; i += 1) {
            processEnvelope(envelope({ session_id: `s${String(i).padStart(2, '0')}`, file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        }
        const dir = arrivalsDir(env);
        for (const f of fs.readdirSync(dir)) fs.utimesSync(path.join(dir, f), 5_000, 5_000);
        processEnvelope(envelope({ session_id: 'zz', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.readdirSync(dir)).toHaveLength(KEEP_SESSIONS);
    });

    it('a write to an existing session prunes too, so a count above fifty does not survive', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < KEEP_SESSIONS + 1; i += 1) {
            const f = path.join(dir, `n${String(i).padStart(2, '0')}.jsonl`);
            fs.writeFileSync(f, '{}\n', { mode: 0o600 });
            fs.utimesSync(f, 5_000 + i, 5_000 + i);
        }
        processEnvelope(envelope({ session_id: 'n10', file_path: USER_RULE('a'), load_reason: 'compact' }), env);
        expect(fs.readdirSync(dir)).toHaveLength(KEEP_SESSIONS);
    });

    it('a file exactly at the cap takes no further line', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'cap.jsonl'), 'x'.repeat(MAX_SESSION_BYTES), { mode: 0o600 });
        processEnvelope(envelope({ session_id: 'cap', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.statSync(path.join(dir, 'cap.jsonl')).size).toBe(MAX_SESSION_BYTES);
    });

    it('a non-session entry in the directory is neither read nor pruned', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'README'), 'x');
        processEnvelope(envelope({ session_id: 'ok', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.readdirSync(dir).sort()).toEqual(['README', 'ok.jsonl']);
    });

    it('a symlinked session file is never appended to', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        const target = path.join(root, 'elsewhere.txt');
        fs.writeFileSync(target, '');
        fs.symlinkSync(target, path.join(dir, 'link.jsonl'));
        processEnvelope(envelope({ session_id: 'link', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.readFileSync(target, 'utf8')).toBe('');
        expect(lastObserverError(dir), 'the refusal leaves a mark').toMatch(/ ELOOP$/);
    });

    it('a non-regular entry is never pruned, and only regular session files count toward the fifty', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(path.join(dir, 'adir.jsonl'), { recursive: true });
        fs.utimesSync(path.join(dir, 'adir.jsonl'), 1, 1);
        for (let i = 0; i < KEEP_SESSIONS + 3; i += 1) {
            processEnvelope(envelope({ session_id: `s${String(i).padStart(2, '0')}`, file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        }
        const left = fs.readdirSync(dir);
        expect(left).toContain('adir.jsonl');
        expect(left.filter((f) => /^s\d\d\.jsonl$/.test(f))).toHaveLength(KEEP_SESSIONS);
    });

    it('a payload without a session id writes nothing, so it can never form a record', () => {
        for (let i = 0; i < 3; i += 1) processEnvelope(envelope({ file_path: USER_RULE(`r${String(i)}`), load_reason: 'session_start' }), env);
        expect(fs.existsSync(arrivalsDir(env))).toBe(false);
    });

    it('a session file someone else can read is refused, and the refusal leaves a mark', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'open.jsonl'), '', { mode: 0o644 });
        fs.chmodSync(path.join(dir, 'open.jsonl'), 0o644);
        processEnvelope(envelope({ session_id: 'open', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        expect(fs.readFileSync(path.join(dir, 'open.jsonl'), 'utf8')).toBe('');
        expect(lastObserverError(dir)).toMatch(/ EREFUSED$/);
    });

    it('a FIFO planted at the session path neither stalls nor receives the line', () => {
        const dir = arrivalsDir(env);
        fs.mkdirSync(dir, { recursive: true });
        expect(spawnSync('mkfifo', [path.join(dir, 'fifo.jsonl')]).status).toBe(0);
        const started = Date.now();
        expect(processEnvelope(envelope({ session_id: 'fifo', file_path: USER_RULE('a'), load_reason: 'session_start' }), env)).toBe(0);
        expect(Date.now() - started).toBeLessThan(2_000);
        expect(lastObserverError(dir)).toMatch(/ (ENXIO|EREFUSED)$/);
    });

    it('never throws, whatever it is handed', () => {
        expect(processEnvelope(undefined as unknown as string, env)).toBe(0);
        expect(processEnvelope('null', { ...env, EVENT4U_CONFIG_HOME: '\0' })).toBe(0);
    });

    it('one unreadable session file does not discard the others', () => {
        processEnvelope(envelope({ session_id: 'ok', file_path: USER_RULE('a'), load_reason: 'session_start' }), env);
        fs.mkdirSync(path.join(arrivalsDir(env), 'broken.jsonl'));
        expect(readObserverLines(arrivalsDir(env)).map((l) => l.session)).toEqual(['ok']);
    });
});

describe('arrival_report', () => {
    it('prints one block per session, newest first, and nothing for an empty directory', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arrival-report-'));
        const cap = (sid: string, ts: string) =>
            JSON.stringify(captureInstructionsLoaded({ hook_event_name: 'InstructionsLoaded', session_id: sid, file_path: USER_RULE('a'), load_reason: 'session_start' }, ts, HOME, ENV));
        fs.writeFileSync(path.join(dir, 'old.jsonl'), cap('old', '2026-10-18T00:00:01Z'));
        fs.writeFileSync(path.join(dir, 'new.jsonl'), cap('new', '2026-10-18T00:00:02Z'));
        const records = recordsIn(dir, 10);
        expect(records.map((r) => r.session)).toEqual(['new', 'old']);
        expect(renderRecord(records[0]!).join('\n')).toContain('host version 2.1.299');
        expect(recordsIn(path.join(dir, 'missing'), 10)).toEqual([]);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
