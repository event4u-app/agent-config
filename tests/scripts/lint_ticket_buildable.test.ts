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
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    _cycle,
    _has_concrete_path,
    _parse_ticket,
    _setRoadmapsForTest,
    _setTicketsRootForTest,
} from '../../src/scripts/lint_ticket_buildable.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


// --- Ticket builders --------------------------------------------------------


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



