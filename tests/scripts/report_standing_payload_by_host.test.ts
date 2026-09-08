/**
 * The report script's own assertions (R2 findings 8, 9, 10, 14).
 *
 * Every figure this script publishes is read from the working tree, and the
 * artifact it writes opens with a `file:line` provenance table and a pin. Four
 * of its guards were weaker than the sentences they back:
 *
 *   · 8  `assertWritersResolve` was a BOUNDS test presented as a provenance
 *        test — it checked that the cited line number was inside the file and
 *        never looked at the line.
 *   · 9  `--pin` was free text with no comparison against HEAD, while the
 *        artifact claims a re-run at the same pin is byte-identical.
 *   · 10 `readCorpusPositives` silently skipped every YAML shape its hand
 *        parser could not read, under-counting the distribution a budget row
 *        is derived from.
 *   · 14 the success line hardcoded `HOST_SURFACES.length - 1`.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    HOST_SURFACES,
    assertWritersResolve,
    citedWriterCount,
    corpusShapeProblems,
    pinProblem,
    readCorpusPositives,
} from '../../src/scripts/report_standing_payload_by_host.js';

const temps: string[] = [];

afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rspbh-'));
    temps.push(d);
    return d;
}

describe('8 — a writer citation is checked against the LINE, not the line count', () => {
    it('every shipped citation resolves against the real tree', () => {
        expect(assertWritersResolve(process.cwd())).toEqual([]);
        // The set under assertion must be non-empty, or an empty-vs-empty pass
        // proves nothing.
        expect(citedWriterCount()).toBeGreaterThan(5);
    });

    it('a citation whose line no longer carries its anchor is reported', () => {
        const root = tmpdir();
        const surface = HOST_SURFACES.find((h) => h.host === 'claude-code');
        expect(surface).toBeDefined();
        const [rel] = (surface as { writer: string }).writer.split(':');
        const abs = path.join(root, rel as string);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        // Long enough that the BOUNDS test passes, and carrying none of the
        // anchors — this is the drift the old check could not see.
        fs.writeFileSync(abs, 'x\n'.repeat(6000), 'utf-8');
        const problems = assertWritersResolve(root);
        expect(problems.length).toBeGreaterThan(0);
        expect(problems.join('\n')).toContain('anchor');
    });
});

describe('9 — the pin is asserted against HEAD, never accepted as free text', () => {
    it('a pin that is not HEAD is a problem', () => {
        const problem = pinProblem(process.cwd(), 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
        expect(problem).not.toBeNull();
        expect(problem as string).toContain('HEAD');
    });

    it('the resolved HEAD is accepted', () => {
        const head = execFileSync('git', ['-C', process.cwd(), 'rev-parse', 'HEAD'], {
            encoding: 'utf-8',
        }).trim();
        expect(pinProblem(process.cwd(), head)).toBeNull();
    });
});

describe('10 — an unreadable corpus shape fails loudly instead of under-counting', () => {
    it('a single-quoted prompt is reported rather than skipped', () => {
        const root = tmpdir();
        const dir = path.join(root, 'tests', 'eval', 'routing-matrix');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'a.yaml'),
            "rule: a\npositives:\n  - prompt: 'single quoted'\nnear_misses: []\n",
            'utf-8',
        );
        expect(readCorpusPositives(root)).toEqual([]);
        const problems = corpusShapeProblems(root);
        expect(problems.length).toBe(1);
        expect(problems[0] as string).toContain('a.yaml');
    });

    it('the shipped corpus is fully readable', () => {
        expect(corpusShapeProblems(process.cwd())).toEqual([]);
        expect(readCorpusPositives(process.cwd()).length).toBeGreaterThan(300);
    });
});

describe('14 — the citation ratio is counted, not derived from a constant', () => {
    it('counts the surfaces that actually carry a citation', () => {
        const surfaceless = HOST_SURFACES.filter((h) => h.writer === '—').length;
        expect(citedWriterCount()).toBe(HOST_SURFACES.length - surfaceless);
    });
});
