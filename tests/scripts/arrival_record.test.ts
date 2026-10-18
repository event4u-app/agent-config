import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { classifyInstructionsLoaded, hostVersionFromEnv, type ObserverLine } from '../../src/scripts/_lib/instructions_loaded_event.js';
import {
    arrivalEvidence,
    arrivalReceipts,
    buildArrivalRecord,
    latestArrivalRecord,
    readObserverLines,
    validateArrivalRecord,
} from '../../src/scripts/_lib/arrival_record.js';
import { rungState } from '../../src/scripts/_lib/activation_ladder.js';
import { processEnvelope, arrivalsPath, KILL_SWITCH_ENV } from '../../src/scripts/hooks/instructions_observer_hook.js';
import { recordsIn, renderRecord } from '../../src/scripts/arrival_report.js';

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
        expect(line('not an object')).toMatchObject({ event: 'unknown', why: 'malformed' });
        expect(line({ session_id: 's1', hook_event_name: 'Stop' })).toMatchObject({ event: 'unknown', why: 'event-mismatch' });
        expect(line({ session_id: 's1', load_reason: 'session_start' })).toMatchObject({ event: 'unknown', why: 'no-file-path' });
        expect(line({ session_id: 's1', file_path: USER_RULE('a'), load_reason: 'telepathy' })).toMatchObject({ event: 'unknown', why: 'unknown-load-reason' });
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
        'events reordered': [load(USER_RULE('a'), 'path_glob_match'), load(USER_RULE('b'))],
        'no session-start load at all': [load(USER_RULE('a'), 'compact')],
    };
    for (const [name, lines] of Object.entries(controls)) {
        it(`${name} → unknown, never an arrival`, () => {
            const r = buildArrivalRecord(lines, 's1');
            expect(r.status).toBe('unknown');
            expect(arrivalEvidence(r, new Set(['a']))).toBeNull();
        });
    }

    it('a session mixing host versions is unknown', () => {
        const other = classifyInstructionsLoaded(
            { session_id: 's1', file_path: USER_RULE('b'), load_reason: 'session_start' },
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

    const envelope = (payload: unknown) =>
        JSON.stringify({ schema_version: 1, platform: 'claude', event: 'instructions_loaded', payload });

    it('appends one line per event and a record can be built from the file', () => {
        expect(processEnvelope(envelope({ session_id: 's9', file_path: USER_RULE('a'), load_reason: 'session_start' }), env)).toBe(0);
        expect(processEnvelope('{not json', env)).toBe(0);
        const lines = readObserverLines(arrivalsPath(env));
        expect(lines).toHaveLength(2);
        expect(latestArrivalRecord(lines.filter((l) => l.session !== null))?.status).toBe('visible');
    });

    it('the kill switch writes nothing', () => {
        processEnvelope(envelope({ session_id: 's9', file_path: USER_RULE('a'), load_reason: 'session_start' }), { ...env, [KILL_SWITCH_ENV]: 'off' });
        expect(fs.existsSync(arrivalsPath(env))).toBe(false);
    });

    it('ignores an envelope for another event', () => {
        processEnvelope(JSON.stringify({ event: 'stop', payload: {} }), env);
        expect(fs.existsSync(arrivalsPath(env))).toBe(false);
    });
});

describe('arrival_report', () => {
    it('prints one block per session, newest first, and nothing for an empty file', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arrival-report-'));
        const file = path.join(dir, 'arrivals.jsonl');
        const lines = [load(USER_RULE('a'), 'session_start', 'old'), load(USER_RULE('a'), 'session_start', 'new')];
        fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n'));
        const records = recordsIn(file, 10);
        expect(records.map((r) => r.session)).toEqual(['new', 'old']);
        expect(renderRecord(records[0]!).join('\n')).toContain('host version 2.1.299');
        expect(recordsIn(path.join(dir, 'missing.jsonl'), 10)).toEqual([]);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
