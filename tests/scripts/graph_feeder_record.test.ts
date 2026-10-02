/**
 * The graph feeder record — `road-to-a-graph-that-feeds-the-gate` step 3.2.
 *
 * Two layers, for the reason the gate's own suite gives: the row BUILDER is a
 * pure function and is asserted as one, while the claim that matters — the
 * shadow changes no exit code — can only be made against the real process,
 * because an in-process call cannot show that a graph loaded at turn end left
 * the gate's verdict alone.
 *
 * The exit-code assertion is comparative on purpose. "Exit 1 with a graph
 * present" proves nothing by itself; the same turn run WITHOUT a graph and
 * WITH one, exiting identically, is what rules the graph out as an input.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import {
    appendFeederRow,
    buildFeederRow,
    graphUntestedVerdict,
    MAX_ROWS_PER_SESSION,
    readFeederRows,
} from '../../src/scripts/_lib/graph_feeder_record.js';
import { deriveSessionKey } from '../../src/scripts/hooks/turn_end_gate_hook.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'turn_end_gate_hook.ts');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const SESSION = 'graph-feeder-fixture-session';

const tmp_dirs: string[] = [];
afterAll(() => {
    for (const d of tmp_dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const SERVICE = 'export function handle(x: string): string {\n    return x.trim();\n}\n';
const MAIN = "import { handle } from './service.js';\n\nexport function run(): string {\n    return handle('a');\n}\n";

/**
 * A workspace with production code and NO test file — the shape step 3.2's
 * verify names ("an untested production edit").
 *
 * `withGraph` decides whether a native cache is built. The dir is not a git
 * repository, so freshness is unknown and `graphState` reads `fresh`, which is
 * exactly the state the feeder acts on.
 */
async function rig(withGraph: boolean): Promise<{ dir: string; home: string }> {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'graph-feeder-')));
    const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'graph-feeder-home-')));
    tmp_dirs.push(dir, home);
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'service.ts'), SERVICE);
    fs.writeFileSync(path.join(dir, 'src', 'main.ts'), MAIN);
    if (withGraph) await buildFromRepo(dir, path.join(dir, 'agents/runtime/state/code-graph-v1.json'));
    return { dir, home };
}

/** A turn that edited production code and claimed it was done. */
function transcript(home: string, tag: string): string {
    const file = path.join(home, `transcript-${tag}.jsonl`);
    fs.writeFileSync(
        file,
        [
            { type: 'user', message: { content: 'mach das fertig' } },
            {
                type: 'assistant',
                message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/service.ts' } }] },
            },
            { type: 'assistant', message: { content: [{ type: 'text', text: 'Fertig. Der Service trimmt jetzt.' }] } },
        ]
            .map((e) => JSON.stringify(e))
            .join('\n') + '\n',
    );
    return file;
}

function runHook(dir: string, home: string, transcriptPath: string): { status: number; stderr: string } {
    const r = spawnSync(
        TSX,
        [HOOK],
        {
            encoding: 'utf8',
            cwd: dir,
            input: JSON.stringify({
                schema_version: 1,
                platform: 'claude',
                event: 'stop',
                native_event: 'Stop',
                session_id: SESSION,
                workspace_root: dir,
                payload: { transcript_path: transcriptPath },
                settings: {},
            }),
            env: {
                ...process.env,
                HOME: home,
                USERPROFILE: home,
                EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
            },
        },
    );
    return { status: r.status ?? 1, stderr: r.stderr ?? '' };
}

describe('3.2 — both verdicts land on the feeder record, and the exit code does not move', () => {
    it('writes F and the graph verdict for an untested production edit, with the verdict unchanged', async () => {
        const withGraph = await rig(true);
        const withoutGraph = await rig(false);

        const a = runHook(withGraph.dir, withGraph.home, transcript(withGraph.home, 'a'));
        const b = runHook(withoutGraph.dir, withoutGraph.home, transcript(withoutGraph.home, 'b'));

        // THE claim of a shadow: identical verdicts on the identical turn, with
        // and without a graph. If the graph ever reaches the exit code, this is
        // the assertion that says so.
        expect(a.status, a.stderr).toBe(b.status);
        expect(a.stderr).toContain('untested');

        const key = deriveSessionKey(SESSION);
        const rows = readFeederRows(withGraph.dir, key);
        expect(rows.length).toBeGreaterThan(0);
        const row = rows[0];
        expect(row?.graph_state).toBe('fresh');
        // F fired — the turn edited production code, touched no test and said done.
        expect(row?.f).toBe(true);
        expect(row?.f_mode).toBe('transcript');
        // And so did the graph, independently: nothing in the index tests `handle`.
        expect(row?.graph).toBe('untested');
        expect(row?.graph_untested).toBeGreaterThan(0);
        expect(row?.paths).toContain('src/service.ts');

        // NOT the Q1 instrument (D3): the shadow record this step must not
        // contaminate is a different file, and it keeps its own shape.
        const feeder = path.join(withGraph.dir, 'agents', 'state', 'graph-feeder', `${key}.jsonl`);
        expect(fs.existsSync(feeder)).toBe(true);
        expect(feeder).not.toContain('runtime');

        // A repository with no graph grows no file at all — a consumer who never
        // builds one never pays for this.
        expect(readFeederRows(withoutGraph.dir, key)).toStrictEqual([]);
    }, 120_000);
});

describe('graphUntestedVerdict — the graph half, in isolation', () => {
    it('contributes nothing on a stale or absent graph, or with no edit paths', async () => {
        const { dir } = await rig(true);
        // `behind:N` and `absent` are the two states the step says contribute
        // nothing; the probe must not even look.
        expect(graphUntestedVerdict(dir, 'behind:3', ['src/service.ts']).verdict).toBeNull();
        expect(graphUntestedVerdict(dir, 'absent', ['src/service.ts']).verdict).toBeNull();
        expect(graphUntestedVerdict(dir, 'fresh', []).verdict).toBeNull();
    }, 120_000);

    it('answers untested for a production file no test imports', async () => {
        const { dir } = await rig(true);
        const r = graphUntestedVerdict(dir, 'fresh', ['src/service.ts']);
        expect(r.verdict).toBe('untested');
        expect(r.untested).toBeGreaterThan(0);
    }, 120_000);

    it('reports no-seeds for a path the index does not carry', async () => {
        const { dir } = await rig(true);
        // A real answer, not an error: the graph was consulted and had nothing
        // to say about this path, which is different from not consulting it.
        expect(graphUntestedVerdict(dir, 'fresh', ['docs/README.md']).verdict).toBe('no-seeds');
    }, 120_000);
});

describe('buildFeederRow — the row shape', () => {
    it('caps the path list, keeps the true count, and carries no free-form field', () => {
        const row = buildFeederRow({
            turn: 3,
            layer: 'live',
            state: 'edited',
            fFired: false,
            fMode: null,
            paths: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts', 'g.ts'],
            graph: { verdict: 'tested', untested: 0, tested: 2 },
            at: '2026-10-01T00:00:00.000Z',
        });
        expect(row.paths).toHaveLength(5);
        expect(row.path_count).toBe(7);
        // PII-exclusion by construction: the key set is closed, so there is no
        // field a prompt, a reply or a command could be written into even by
        // mistake. Asserted rather than described, because a later field that
        // CAN hold free text is exactly the regression this guards.
        expect(Object.keys(row).sort()).toStrictEqual(
            [
                'at',
                'f',
                'f_mode',
                'graph',
                'graph_state',
                'graph_tested',
                'graph_untested',
                'layer',
                'path_count',
                'paths',
                'turn',
            ].sort(),
        );
    });

    it('stops appending at the per-session cap, so the instrument cannot grow without bound', () => {
        // Was an assertion that the constant is a positive integer, which a
        // completion review correctly called tautological: deleting the guard
        // in `appendFeederRow` left it green. This drives the writer past the
        // cap instead, so the guard is what the test is about.
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'graph-feeder-cap-')));
        tmp_dirs.push(root);
        const row = buildFeederRow({
            turn: 1,
            layer: 'live',
            state: 'fresh',
            fFired: false,
            fMode: null,
            paths: [],
            graph: { verdict: null, untested: 0, tested: 0 },
            at: '2026-10-01T00:00:00.000Z',
        });
        for (let i = 0; i < MAX_ROWS_PER_SESSION + 10; i += 1) {
            appendFeederRow(root, 'capped', row);
        }
        expect(readFeederRows(root, 'capped')).toHaveLength(MAX_ROWS_PER_SESSION);
    });
});
