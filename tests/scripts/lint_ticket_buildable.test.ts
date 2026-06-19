// Tests for src/scripts/lint_ticket_buildable.ts (py2ts — ADR-200).
//
// Two layers:
//  1. Unit tests over the exported _cycle / _has_concrete_path / _parse_ticket
//     helpers.
//  2. Golden parity: python3 lint_ticket_buildable.py vs tsx, both pointed at
//     the SAME tmp TICKETS_ROOT + ROADMAPS (Python via an importlib wrapper
//     that monkeypatches TICKETS_ROOT/ROADMAPS; TS via the _set*ForTest seam),
//     asserting byte-identical stdout/stderr + exit across: clean bundle,
//     missing-manifest, dependency cycle, graph/ticket id mismatch (set diff),
//     schema violations (id pattern / status enum / priority maximum / assets
//     anyOf / manifest patternProperties), lite §5 floor, TBD acceptance token,
//     no-frontmatter ticket, unresolved asset, spine marker with no bundle, and
//     the materialized-roadmap warning. The script has NO argparse — an unknown
//     flag is silently ignored (`lint()` ignores argv); that is asserted too.
//     Skipped without python3.
//
// Parity exclusions (documented, not bugs introduced by the twin):
//  - A truthy non-string non-list `assets` (e.g. the int 123) makes the Python
//    original crash with an uncaught `TypeError: 'int' object is not iterable`
//    + a Python traceback. The twin reproduces the crash (same exit code) but a
//    Python traceback is path/interpreter-specific, so it is not byte-compared
//    (only the exit code is asserted).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _cycle,
    _has_concrete_path,
    _parse_ticket,
    _setRoadmapsForTest,
    _setTicketsRootForTest,
} from '../../src/scripts/lint_ticket_buildable.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_ticket_buildable.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_ticket_buildable.ts');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// --- Ticket builders --------------------------------------------------------

const VALID_MANIFEST = [
    'status: ready',
    'planner_tier: high',
    'builder_tier: high',
    'dependency_graph:',
    '  T-001:',
    '    status: ready',
    '    blocks: []',
    '',
].join('\n');

const VALID_TICKET = [
    '---',
    'id: T-001',
    'roadmap: r',
    'phase: 1',
    'title: T',
    'status: ready',
    'model_tier: high',
    'acceptance:',
    '  - run the test',
    'boundaries:',
    '  must_touch:',
    '    - src/x',
    '---',
    'Body.',
    '',
].join('\n');

// --- Unit -------------------------------------------------------------------

describe('lint_ticket_buildable — helpers', () => {
    it('_cycle detects a back-edge and returns the node ring', () => {
        const g = new Map<string, string[]>([
            ['T-001', ['T-002']],
            ['T-002', ['T-001']],
        ]);
        const cyc = _cycle(g);
        expect(cyc).not.toBeNull();
        expect(cyc!.join(' -> ')).toBe('T-001 -> T-002 -> T-001');
    });

    it('_cycle returns null for an acyclic graph', () => {
        const g = new Map<string, string[]>([
            ['T-001', ['T-002']],
            ['T-002', []],
        ]);
        expect(_cycle(g)).toBeNull();
    });

    it('_has_concrete_path: source_refs OR a tier path root in body', () => {
        expect(_has_concrete_path('nothing here', { source_refs: [{ path: 'x', sha: 'y' }] })).toBe(
            true,
        );
        expect(_has_concrete_path('touches src/foo', {})).toBe(true);
        expect(_has_concrete_path('no marker', {})).toBe(false);
    });

    it('_parse_ticket splits frontmatter / body; null on absence', () => {
        const [fm, body] = _parse_ticket(_tmpFile(VALID_TICKET));
        expect(fm).not.toBeNull();
        expect(fm!['id']).toBe('T-001');
        expect(body.trim()).toBe('Body.');
        const [fm2] = _parse_ticket(_tmpFile('no frontmatter\n'));
        expect(fm2).toBeNull();
    });
});

let _scratch: string[] = [];
function _tmpFile(content: string): string {
    const d = fs.mkdtempSync(path.join(REPO_ROOT, 'ltb-u-'));
    _scratch.push(d);
    const f = path.join(d, 'T-001-x.md');
    fs.writeFileSync(f, content, 'utf-8');
    return f;
}
afterEach(() => {
    for (const d of _scratch) {
        fs.rmSync(d, { recursive: true, force: true });
    }
    _scratch = [];
    _setTicketsRootForTest(path.join(REPO_ROOT, 'agents', 'tickets'));
    _setRoadmapsForTest(path.join(REPO_ROOT, 'agents', 'roadmaps'));
});

// --- Golden parity (python3 vs tsx) ----------------------------------------

const py3 = hasPython3();

const PY_WRAPPER = [
    'import importlib.util, os, sys, pathlib',
    'spec = importlib.util.spec_from_file_location("ltb", os.environ["LTB_PY"])',
    'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'm.TICKETS_ROOT = pathlib.Path(os.environ["LTB_TICKETS"])',
    'm.ROADMAPS = pathlib.Path(os.environ["LTB_ROADMAPS"])',
    'sys.exit(m.lint())',
    '',
].join('\n');

const TS_WRAPPER = [
    'import(process.env.LTB_TS).then((m) => {',
    '    m._setTicketsRootForTest(process.env.LTB_TICKETS);',
    '    m._setRoadmapsForTest(process.env.LTB_ROADMAPS);',
    '    process.exitCode = m.lint();',
    '}).catch((e) => { process.stderr.write(String(e) + "\\n"); process.exitCode = 1; });',
    '',
].join('\n');

describe.skipIf(!py3)('lint_ticket_buildable — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    let tickets: string;
    let roadmaps: string;
    let pyWrap: string;
    let tsWrap: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'ltb-parity-'));
        tickets = path.join(tmp, 'tickets');
        roadmaps = path.join(tmp, 'roadmaps');
        fs.mkdirSync(tickets);
        fs.mkdirSync(roadmaps);
        pyWrap = path.join(tmp, 'wrap.py');
        tsWrap = path.join(tmp, 'wrap.mjs');
        fs.writeFileSync(pyWrap, PY_WRAPPER, 'utf-8');
        fs.writeFileSync(tsWrap, TS_WRAPPER, 'utf-8');
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function bundle(name: string, files: Record<string, string>): void {
        const dir = path.join(tickets, name);
        fs.mkdirSync(dir, { recursive: true });
        for (const [fname, content] of Object.entries(files)) {
            fs.writeFileSync(path.join(dir, fname), content, 'utf-8');
        }
    }

    function env() {
        return {
            ...process.env,
            LTB_PY: PY_SCRIPT,
            LTB_TS: pathToFileURL(TS_SCRIPT).href,
            LTB_TICKETS: tickets,
            LTB_ROADMAPS: roadmaps,
        };
    }

    function expectMatch(label: string): void {
        const e = env();
        const py = spawnSync('python3', [pyWrap], { env: e, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [tsWrap], { env: e, encoding: 'utf8' });
        expect(ts.stdout, label).toBe(py.stdout);
        expect(ts.stderr, label).toBe(py.stderr);
        expect(ts.status, label).toBe(py.status);
    }

    it('clean bundle byte-identical', () => {
        bundle('b1', { 'manifest.yml': VALID_MANIFEST, 'T-001-x.md': VALID_TICKET });
        expectMatch('clean');
    });

    it('missing manifest byte-identical', () => {
        bundle('b1', { 'T-001-x.md': VALID_TICKET });
        expectMatch('missing-manifest');
    });

    it('dependency cycle + graph/ticket mismatch byte-identical', () => {
        bundle('b1', {
            'manifest.yml': [
                'status: ready',
                'planner_tier: high',
                'builder_tier: high',
                'dependency_graph:',
                '  T-001:',
                '    status: ready',
                '    blocks: [T-002]',
                '  T-002:',
                '    status: ready',
                '    blocks: [T-001]',
                '',
            ].join('\n'),
            'T-001-x.md': VALID_TICKET,
        });
        expectMatch('cycle');
    });

    it('schema: bad id pattern byte-identical', () => {
        bundle('b1', {
            'manifest.yml': 'status: ready\nplanner_tier: high\nbuilder_tier: high\ndependency_graph: {}\n',
            'T-001-x.md': VALID_TICKET.replace('id: T-001', 'id: BADID'),
        });
        expectMatch('schema-id');
    });

    it('schema: status enum byte-identical', () => {
        bundle('b1', {
            'manifest.yml': VALID_MANIFEST,
            'T-001-x.md': VALID_TICKET.replace('status: ready', 'status: nope'),
        });
        expectMatch('schema-status');
    });

    it('schema: priority maximum byte-identical', () => {
        bundle('b1', {
            'manifest.yml': VALID_MANIFEST,
            'T-001-x.md': VALID_TICKET.replace('model_tier: high', 'model_tier: high\npriority: 9'),
        });
        expectMatch('schema-priority');
    });

    it('schema: manifest patternProperties bad key byte-identical', () => {
        bundle('b1', {
            'manifest.yml': [
                'status: ready',
                'planner_tier: high',
                'builder_tier: high',
                'dependency_graph:',
                '  BADKEY:',
                '    status: ready',
                '    blocks: []',
                '',
            ].join('\n'),
            'T-001-x.md': VALID_TICKET,
        });
        expectMatch('schema-manifest-pattern');
    });

    it('lite §5 floor failures + TBD token byte-identical', () => {
        bundle('b1', {
            'manifest.yml': 'status: ready\nplanner_tier: lite\nbuilder_tier: lite\ndependency_graph: {}\n',
            'T-001-x.md': [
                '---',
                'id: T-001',
                'roadmap: r',
                'phase: 1',
                'title: T',
                'status: ready',
                'model_tier: lite',
                'acceptance:',
                '  - figure out the thing',
                'boundaries:',
                '  must_touch: []',
                '---',
                'No concrete path marker, no do-not-touch.',
                '',
            ].join('\n'),
        });
        expectMatch('lite-floor');
    });

    it('no-frontmatter ticket byte-identical', () => {
        bundle('b1', {
            'manifest.yml': 'status: ready\nplanner_tier: high\nbuilder_tier: high\ndependency_graph: {}\n',
            'T-002-y.md': 'No frontmatter at all.\n',
        });
        expectMatch('no-frontmatter');
    });

    it('unresolved asset byte-identical', () => {
        bundle('b1', {
            'manifest.yml': VALID_MANIFEST,
            'T-001-x.md': VALID_TICKET.replace(
                'model_tier: high',
                'model_tier: high\nassets: [missing-asset.png]',
            ),
        });
        expectMatch('asset-unresolved');
    });

    it('spine: roadmap marker with no bundle ticket byte-identical', () => {
        bundle('b1', { 'manifest.yml': VALID_MANIFEST, 'T-001-x.md': VALID_TICKET });
        fs.writeFileSync(
            path.join(roadmaps, 'road-x.md'),
            ['## Phase 1 — A', '- [ ] do thing', '<!-- ticket: T-001 -->', '<!-- ticket: T-999 -->', ''].join(
                '\n',
            ),
            'utf-8',
        );
        expectMatch('spine');
    });

    it('materialized roadmap: phase with steps, no marker → warn byte-identical', () => {
        bundle('b1', { 'manifest.yml': VALID_MANIFEST, 'T-001-x.md': VALID_TICKET });
        fs.writeFileSync(
            path.join(roadmaps, 'road-x.md'),
            [
                '## Phase 1 — A',
                '- [ ] do thing',
                '<!-- ticket: T-001 -->',
                '## Phase 2 — B',
                '- [x] another step',
                '## Notes',
                'free text',
                '',
            ].join('\n'),
            'utf-8',
        );
        expectMatch('materialized-warn');
    });

    it('no tickets dir → "no bundles yet" byte-identical', () => {
        fs.rmSync(tickets, { recursive: true, force: true });
        expectMatch('no-bundles');
    });

    it('unknown flag is silently ignored (no argparse) — exit + output identical', () => {
        // lint() ignores argv entirely; running the scripts directly with a
        // bogus flag must still lint the REAL repo and exit identically.
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
