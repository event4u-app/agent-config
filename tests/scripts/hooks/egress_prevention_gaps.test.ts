/**
 * What prevention cannot see (road-to-one-detector-and-the-senders-we-own 1.3).
 *
 * A read guard refuses to open a credential-class file. Three channels carry a
 * credential without any such read: a value a program prints, a row a database
 * tool returns, and a secret the user types. Each is a fixture under
 * tests/fixtures/egress-prevention-gaps/, and each names in `closed_by` the step
 * of the host-carrier roadmap that closes it.
 *
 * A closing step inverts the second assertion for its fixtures: placeholders
 * 3.1 makes the dispatcher hand the host a replaced tool result for the two
 * result fixtures. The typed prompt stays open until 5.1 lands, so for it the
 * assertion still describes the gap. Values are built at runtime and every
 * assertion is a boolean or a count.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { countEnvelope, OBSERVATION_FILE } from '../../../src/scripts/hooks/egress_stage.js';
import type { EgressObservationLine } from '../../../src/scripts/hooks/egress_stage.js';
import type { JsonObject } from '../../../src/scripts/hooks/payload_stub.js';
import { feedback_dir } from '../../../src/scripts/hooks/state_io.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'egress-prevention-gaps');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const REPORT_VIEW = 'tests/hooks/fixtures/concern_report_egress_view.ts';
const CLOSING_ROADMAP = path.join(REPO_ROOT, 'agents', 'roadmaps', 'road-to-placeholders-on-the-wire.md');

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';

/** The planted value per fixture, assembled so no credential literal sits in this file. */
const VALUES: Readonly<Record<string, string>> = {
    'program-output': ALNUM.slice(0, 20),
    'database-row': ['ghp', ALNUM.slice(0, 36)].join('_'),
    'typed-secret': ['sk', 'ant', 'api03', ALNUM + ALNUM.slice(0, 10)].join('-'),
};

const REWRITE_FIELDS = ['updatedToolOutput', 'updatedInput', 'updatedPrompt'];

interface GapFixture {
    readonly closed_by: string;
    readonly gap: string;
    readonly event: string;
    readonly native_event: string;
    readonly payload: JsonObject;
}

function load(name: string): GapFixture {
    const raw = fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf8');
    const value = VALUES[name];
    if (value === undefined) throw new Error(`no planted value for ${name}`);
    return JSON.parse(raw.replace('{{VALUE}}', value)) as GapFixture;
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-gaps-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function writeManifest(target: string): void {
    fs.writeFileSync(
        target,
        [
            'schema_version: 1',
            'concerns:',
            '  recorder:',
            `    script: ${REPORT_VIEW}`,
            '    args: []',
            '    fail_closed: false',
            '    severity: advisory',
            '    effect: telemetry',
            '    needs_payload_bodies: [input, result]',
            'platforms:',
            '  claude:',
            '    post_tool_use: [recorder]',
            '    user_prompt_submit: [recorder]',
            '',
        ].join('\n'),
        'utf8',
    );
}

function dispatch(fixture: GapFixture): { status: number | null; stdout: string; stderr: string; ws: string } {
    const ws = path.join(tmp, 'ws');
    fs.mkdirSync(ws, { recursive: true });
    fs.writeFileSync(path.join(ws, '.agent-settings.yml'), 'egress:\n  placeholders:\n    mode: strict\n');
    const manifest = path.join(tmp, 'manifest.yaml');
    writeManifest(manifest);
    // Claude Code stamps its version on every transcript line; the stage reads it to rule out drift,
    // only from the session's own transcript under the host's projects directory.
    const sid = String(fixture.payload['session_id'] ?? 'gap-session');
    const configDir = path.join(tmp, 'claude-config');
    const transcript = path.join(configDir, 'projects', 'p', `${sid}.jsonl`);
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, `${JSON.stringify({ version: '2.1.304' })}\n`);
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
    delete env['AGENT_CONFIG_REPLAY'];
    delete env['AGENT_CONFIG_NO_EGRESS_STAGE'];
    const r = spawnSync(
        TSX_BIN,
        [TS_SCRIPT, '--platform', 'claude', '--event', fixture.event, '--native-event', fixture.native_event, '--manifest', manifest],
        { cwd: ws, input: JSON.stringify({ ...fixture.payload, transcript_path: transcript }), encoding: 'utf8', env },
    );
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, ws };
}

const NAMES = Object.keys(VALUES);

/**
 * The dispatcher's stdout as the host reads it: nothing, or one JSON object. A
 * non-empty stdout that does not parse fails the test instead of being searched.
 */
function hostOutput(stdout: string): JsonObject {
    const text = stdout.trim();
    if (text === '') return {};
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('dispatcher stdout is not a JSON object');
    }
    return parsed as JsonObject;
}

/** Every key at any depth, so a rewrite field nested under `hookSpecificOutput` is seen. */
function keysDeep(value: unknown, into: Set<string> = new Set()): Set<string> {
    if (value !== null && typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            into.add(k);
            keysDeep(v, into);
        }
    }
    return into;
}

/** The observation lines the stage appended in this workspace — a fresh one per test. */
function observations(ws: string): EgressObservationLine[] {
    const file = path.join(ws, OBSERVATION_FILE);
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as EgressObservationLine);
}

/** The body of one numbered step: its checkbox line up to the next step or heading. */
function roadmapStep(markdown: string, step: string): string | null {
    const lines = markdown.split('\n');
    const head = new RegExp(`^- \\[[ x~-]\\] (?:<!--.*?--> )?\\*\\*${step.replace('.', '\\.')} `);
    const start = lines.findIndex((l) => head.test(l));
    if (start < 0) return null;
    let end = start + 1;
    while (end < lines.length && !/^(- \[|#)/.test(lines[end] ?? '')) end++;
    return lines.slice(start, end).join('\n');
}

describe('egress prevention gaps', () => {
    it('the fixture directory holds exactly the named gaps, each with a closing step', () => {
        const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
        expect(files.sort()).toEqual([...NAMES].sort());
        for (const name of NAMES) {
            const f = load(name);
            expect(f.closed_by).toMatch(/^road-to-placeholders-on-the-wire \d+\.\d+$/);
            expect(f.gap.length).toBeGreaterThan(20);
        }
    });

    it('each closed_by names a step of the closing roadmap, and that step names the fixture back', () => {
        const markdown = fs.readFileSync(CLOSING_ROADMAP, 'utf8');
        for (const name of NAMES) {
            const step = load(name).closed_by.replace(/^road-to-placeholders-on-the-wire /, '');
            const body = roadmapStep(markdown, step);
            expect(body, `${name}: step ${step} exists`).not.toBeNull();
            expect(body?.includes(`${name}.json`), `${name}: step ${step} names the fixture`).toBe(true);
        }
    });

    for (const name of NAMES) {
        it(`${name}: the stage detects the credential the channel carries`, () => {
            const f = load(name);
            const counted = countEnvelope({ payload: f.payload } as JsonObject);
            const credentials = counted.counts.filter((c) => c.class === 'credential').reduce((n, c) => n + c.count, 0);
            expect(credentials).toBeGreaterThan(0);
        });

        it(`${name}: the dispatcher closes the channel its fixture names, or the gap stands until its step lands`, () => {
            const f = load(name);
            const { status, stdout, stderr, ws } = dispatch(f);
            const value = VALUES[name] as string;
            // The concern ran under the stage: without this the assertions below
            // would also pass for a dispatcher that exited before the concern loop.
            const sid = String(f.payload['session_id']);
            const dir = feedback_dir(path.join(ws, 'agents', 'runtime', 'state'), sid);
            expect(fs.existsSync(path.join(dir, 'recorder.json'))).toBe(true);
            // The stage ran in this same invocation and counted the credential: its
            // observation line is the only one in this fresh workspace.
            const lines = observations(ws);
            expect(lines.length).toBe(1);
            const [line] = lines;
            expect(line?.event).toBe(f.event);
            expect(line?.mode).toBe('strict');
            const counted = (line?.counts ?? []).filter((c) => c.class === 'credential').reduce((n, c) => n + c.count, 0);
            expect(counted).toBeGreaterThan(0);
            expect(stdout.includes(value) || stderr.includes(value)).toBe(false);
            if (f.event === 'user_prompt_submit') {
                // Still open until 5.1 lands: no rewrite field anywhere, and no block.
                expect(status).toBe(0);
                const keys = keysDeep(hostOutput(stdout));
                for (const field of REWRITE_FIELDS) expect(keys.has(field)).toBe(false);
                expect(hostOutput(stdout)['decision']).not.toBe('block');
                return;
            }
            // 3.1: exactly one rewrite field, carrying the original object's keys.
            expect(status).toBe(0);
            const out = hostOutput(stdout);
            const hso = out['hookSpecificOutput'] as JsonObject;
            const field = String(f.payload['tool_name']).startsWith('mcp__') ? 'updatedMCPToolOutput' : 'updatedToolOutput';
            const emitted = REWRITE_FIELDS.concat(['updatedMCPToolOutput']).filter((k) => keysDeep(out).has(k));
            expect(emitted).toEqual([field]);
            expect(Object.keys(hso[field] as JsonObject)).toEqual(Object.keys(f.payload['tool_response'] as JsonObject));
        });
    }
});
