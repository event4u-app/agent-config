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
    OUTSIDE_WORKSPACE,
    readFeederRows,
    toRepoRelative,
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
            root: '/workspace',
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
            root: '/workspace',
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

/**
 * The path shape a real host actually emits.
 *
 * Every fixture above hands the feeder a REPO-RELATIVE path, and that is why
 * the arm looked healthy while it was mute: Claude Code writes `file_path` as an
 * ABSOLUTE path, the graph's seed ladder resolves node ids keyed on repo-relative
 * paths, and the two never met. Step 3.3's accrual window recorded `no-seeds` on
 * every row that carried a path — 19 of 19 — and a recall table built on that
 * would have scored a defect and called it a detector.
 *
 * Both assertions are written against the absolute shape on purpose. A fixture
 * that keeps feeding relative paths cannot see this regression come back.
 */
describe('3.3 — the arm reads the path shape a host emits, not the one a fixture does', () => {
    it('resolves an absolute in-workspace path to the same verdict as its relative form', async () => {
        const { dir } = await rig(true);
        const rel = graphUntestedVerdict(dir, 'fresh', ['src/service.ts']);
        const abs = graphUntestedVerdict(dir, 'fresh', [path.join(dir, 'src', 'service.ts')]);
        expect(rel.verdict).toBe('untested');
        // The claim: the absolute form is the SAME answer, not `no-seeds`.
        expect(abs.verdict).toBe(rel.verdict);
        expect(abs.untested).toBe(rel.untested);
        expect(abs.tested).toBe(rel.tested);
    }, 120_000);

    it('keeps an out-of-workspace path verbatim for the PROBE and drops it from the ROW', async () => {
        const { dir } = await rig(true);
        const outside = path.join(os.tmpdir(), 'not-this-workspace', 'elsewhere.ts');
        // Honest boundary: a path outside the root is not graph-addressable, so
        // the probe leaves it alone rather than rewrite it into a `../` that
        // would look relative and index nothing.
        expect(graphUntestedVerdict(dir, 'fresh', [outside]).verdict).toBe('no-seeds');
        // `no-seeds` alone could not go red here — it is equally true under the
        // `../` rewrite the docstring rules out AND under the pre-fix absolute
        // passthrough. So assert what `toRepoRelative` actually singles out.
        expect(toRepoRelative(dir, [outside])).toStrictEqual([outside]);

        // The ROW is the egress surface — `paths` reaches external council seats
        // at labelling — so there the out-of-workspace path is REDACTED.
        //
        // Redacted and not dropped, which is the assertion that matters. The
        // lengths stay equal, so truncation remains the ONLY cause of
        // `path_count > paths.length` and the protocol's exclusion rule keeps
        // meaning one thing. Dropping would have excluded this row from the
        // corpus entirely and taken a perfectly labellable in-repo path with it.
        const row = buildFeederRow({
            root: dir,
            turn: 1,
            layer: 'live',
            state: 'fresh',
            fFired: false,
            fMode: null,
            paths: [path.join(dir, 'src', 'service.ts'), outside],
            graph: { verdict: null, untested: 0, tested: 0 },
            at: '2026-10-06T00:00:00.000Z',
        });
        expect(row.paths).toStrictEqual(['src/service.ts', OUTSIDE_WORKSPACE]);
        expect(row.path_count).toBe(2);
        expect(row.paths).toHaveLength(row.path_count);
        // Nothing identifying survives: no absolute prefix, and specifically not
        // the temp-dir root the out-of-tree path was built from.
        for (const p of row.paths) {
            expect(path.isAbsolute(p)).toBe(false);
            expect(p).not.toContain(os.tmpdir());
        }
    }, 120_000);

    it('emits POSIX separators, because the index matches source_file by exact string', () => {
        // The indexer writes `source_file` through `toPosixRel`
        // (`code_graph/build.ts:108`) and the store compares it literally, so a
        // backslash spelling resolves no seeds and records `no-seeds` — the
        // repaired defect, in platform-conditional form.
        //
        // HONEST LIMIT, stated rather than implied: on a POSIX host `path.sep`
        // is already `/`, so the normalisation is a no-op and this assertion
        // CANNOT go red here. It pins the contract; it does not guard it. The
        // assertion that can go red on this platform is the end-to-end row test
        // above, which asserts `graph === 'untested'` and therefore fails unless
        // the stored spelling actually resolves seeds in a real index.
        // `toPosixRel` is private to the builder and is deliberately not
        // exported to be compared against — widening a surface for a test is a
        // worse trade than naming the gap.
        const root = path.join(os.tmpdir(), 'ws');
        const out = toRepoRelative(root, [path.join(root, 'src', 'deep', 'service.ts')]);
        expect(out).toStrictEqual(['src/deep/service.ts']);
    });

    it('stores repo-relative paths on the row when the transcript carries absolute ones', async () => {
        const withGraph = await rig(true);
        const file = path.join(withGraph.home, 'transcript-abs.jsonl');
        fs.writeFileSync(
            file,
            [
                { type: 'user', message: { content: 'mach das fertig' } },
                {
                    type: 'assistant',
                    message: {
                        content: [
                            {
                                type: 'tool_use',
                                name: 'Edit',
                                // The absolute form, exactly as the host writes it.
                                input: { file_path: path.join(withGraph.dir, 'src', 'service.ts') },
                            },
                        ],
                    },
                },
                { type: 'assistant', message: { content: [{ type: 'text', text: 'Fertig.' }] } },
            ]
                .map((e) => JSON.stringify(e))
                .join('\n') + '\n',
        );
        runHook(withGraph.dir, withGraph.home, file);

        const rows = readFeederRows(withGraph.dir, deriveSessionKey(SESSION));
        const row = rows[rows.length - 1];
        expect(row?.paths).toStrictEqual(['src/service.ts']);
        // And the graph answered, instead of reporting it had no seeds.
        expect(row?.graph).toBe('untested');
        // No absolute prefix reaches the record, which is what the module header
        // claims the row cannot carry.
        for (const p of row?.paths ?? []) expect(path.isAbsolute(p)).toBe(false);
    }, 120_000);
});
