/**
 * What prevention cannot see (road-to-one-detector-and-the-senders-we-own 1.3).
 *
 * A read guard refuses to open a credential-class file. Three channels carry a
 * credential without any such read: a value a program prints, a row a database
 * tool returns, and a secret the user types. Each is a fixture under
 * tests/fixtures/egress-prevention-gaps/, and each names in `closed_by` the step
 * of the host-carrier roadmap that closes it.
 *
 * These assertions describe the gap as it stands, so they PASS while the gap is
 * open: the stage detects the credential, and the dispatcher, even in `strict`,
 * hands the host nothing that changes what goes to the provider. The closing step
 * inverts the second assertion for its fixture. Values are built at runtime and
 * every assertion is a boolean or a count.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { countEnvelope } from '../../../src/scripts/hooks/egress_stage.js';
import type { JsonObject } from '../../../src/scripts/hooks/payload_stub.js';
import { feedback_dir } from '../../../src/scripts/hooks/state_io.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'egress-prevention-gaps');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const REPORT_VIEW = 'tests/hooks/fixtures/concern_report_egress_view.ts';

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

function dispatch(fixture: GapFixture): { status: number | null; stdout: string; ws: string } {
    const ws = path.join(tmp, 'ws');
    fs.mkdirSync(ws, { recursive: true });
    fs.writeFileSync(path.join(ws, '.agent-settings.yml'), 'egress:\n  placeholders:\n    mode: strict\n');
    const manifest = path.join(tmp, 'manifest.yaml');
    writeManifest(manifest);
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env['AGENT_CONFIG_REPLAY'];
    delete env['AGENT_CONFIG_NO_EGRESS_STAGE'];
    const r = spawnSync(
        TSX_BIN,
        [TS_SCRIPT, '--platform', 'claude', '--event', fixture.event, '--native-event', fixture.native_event, '--manifest', manifest],
        { cwd: ws, input: JSON.stringify(fixture.payload), encoding: 'utf8', env },
    );
    return { status: r.status, stdout: r.stdout, ws };
}

const NAMES = Object.keys(VALUES);

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

    for (const name of NAMES) {
        it(`${name}: the stage detects the credential the channel carries`, () => {
            const f = load(name);
            const counted = countEnvelope({ payload: f.payload } as JsonObject);
            const credentials = counted.counts.filter((c) => c.class === 'credential').reduce((n, c) => n + c.count, 0);
            expect(credentials).toBeGreaterThan(0);
        });

        it(`${name}: today nothing the dispatcher returns changes what reaches the provider`, () => {
            const f = load(name);
            const { status, stdout, ws } = dispatch(f);
            expect(status).toBe(0);
            // The concern ran under the stage: without this the assertions below
            // would also pass for a dispatcher that exited before the concern loop.
            const sid = String(f.payload['session_id']);
            const dir = feedback_dir(path.join(ws, 'agents', 'runtime', 'state'), sid);
            expect(fs.existsSync(path.join(dir, 'recorder.json'))).toBe(true);
            for (const field of REWRITE_FIELDS) expect(stdout.includes(field)).toBe(false);
            expect(/"decision"\s*:\s*"block"/.test(stdout)).toBe(false);
        });
    }
});
