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
    projectedRuleBasenames,
    readCorpusPositives,
    singleFileBytes,
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

// `road-to-a-hook-bundle-with-one-yaml-reader` Phase 3. The census read each
// single-file surface off disk, and three of the four are UNTRACKED generated
// projections — so the windsurf figure reported when this checkout last ran
// `task generate-tools` rather than anything about the tree.
describe('3.1 — a single-file figure comes from the emitter or from a tracked file, never from a generated one', () => {
    const SINGLE = HOST_SURFACES.filter((h) => h.surface !== null && !h.perRuleTree);

    it('every single-file row declares where its bytes come from', () => {
        expect(SINGLE.length).toBeGreaterThan(0);
        for (const h of SINGLE) {
            expect(h.bytes, `${h.host} declares no byte source`).toBeDefined();
        }
    });

    // The negative direction, and the one that would have caught the defect: no
    // single-file row may name an untracked path as the file it reads.
    it('no row reads an untracked path for its figure', () => {
        const tracked = new Set(
            execFileSync('git', ['ls-files'], { cwd: process.cwd(), encoding: 'utf-8' })
                .split('\n')
                .filter((l) => l !== ''),
        );
        for (const h of SINGLE) {
            if (h.bytes?.kind === 'tracked') {
                expect(tracked.has(h.bytes.path), `${h.host} reads untracked ${h.bytes.path}`).toBe(true);
            }
        }
        // And the surfaces themselves are mostly NOT tracked — if they all were,
        // the assertion above would be vacuous.
        expect(SINGLE.some((h) => !tracked.has(h.surface as string))).toBe(true);
    });

    it('a row with no declared source throws rather than falling back to reading the surface', () => {
        const windsurf = SINGLE.find((h) => h.host === 'windsurf');
        expect(windsurf).toBeDefined();
        const stripped = { ...(windsurf as (typeof SINGLE)[number]), bytes: undefined };
        expect(() => singleFileBytes(process.cwd(), stripped)).toThrow(/bytes.*source/iu);
    });

    it('the windsurf figure is the emitter\'s render over the projected rule set', () => {
        const m = singleFileBytes(process.cwd(), SINGLE.find((h) => h.host === 'windsurf') as (typeof SINGLE)[number]);
        expect(m.how).toBe('render');
        expect(m.bytes).toBeGreaterThan(0);
        // Rendered, so it is bounded by the corpus it renders rather than by
        // whatever a generated file happens to hold.
        expect(projectedRuleBasenames(process.cwd()).length).toBeGreaterThan(50);
    });

    it('the codex row refuses with a reason instead of publishing a byte count', () => {
        const m = singleFileBytes(process.cwd(), SINGLE.find((h) => h.host === 'codex') as (typeof SINGLE)[number]);
        expect(m.bytes).toBeNull();
        expect(m.how).toBe('refused');
        expect(m.reason).toBeTruthy();
    });
});

describe('3.2 — the single-file figures are checkout-independent (fresh worktree)', () => {
    /** A root carrying only the TRACKED inputs the census reads — no generated trees. */
    function freshRoot(): string {
        const root = tmpdir();
        const rules = path.join(root, 'dist', 'agent-src', 'rules');
        fs.mkdirSync(rules, { recursive: true });
        const srcRules = path.join(process.cwd(), 'dist', 'agent-src', 'rules');
        for (const f of fs.readdirSync(srcRules).filter((n) => n.endsWith('.md'))) {
            fs.copyFileSync(path.join(srcRules, f), path.join(rules, f));
        }
        fs.copyFileSync(path.join(process.cwd(), 'AGENTS.md'), path.join(root, 'AGENTS.md'));
        fs.mkdirSync(path.join(root, '.github'), { recursive: true });
        fs.copyFileSync(
            path.join(process.cwd(), '.github', 'copilot-instructions.md'),
            path.join(root, '.github', 'copilot-instructions.md'),
        );
        return root;
    }

    const SINGLE = HOST_SURFACES.filter((h) => h.surface !== null && !h.perRuleTree);

    it('every single-file row reads the same on a fresh tree as in this checkout', () => {
        const fresh = freshRoot();
        // The precondition the whole case rests on: the generated surfaces are
        // genuinely absent there.
        expect(fs.existsSync(path.join(fresh, '.windsurfrules'))).toBe(false);
        expect(fs.existsSync(path.join(fresh, 'GEMINI.md'))).toBe(false);
        for (const h of SINGLE) {
            expect(singleFileBytes(fresh, h), `${h.host} differs between checkouts`).toEqual(
                singleFileBytes(process.cwd(), h),
            );
        }
    });

    it('planting a bogus generated surface does not move the figure', () => {
        const fresh = freshRoot();
        const windsurf = SINGLE.find((h) => h.host === 'windsurf') as (typeof SINGLE)[number];
        const before = singleFileBytes(fresh, windsurf);
        fs.writeFileSync(path.join(fresh, '.windsurfrules'), 'x'.repeat(42));
        fs.writeFileSync(path.join(fresh, 'GEMINI.md'), 'y'.repeat(42));
        expect(singleFileBytes(fresh, windsurf)).toEqual(before);
        const gemini = SINGLE.find((h) => h.host === 'gemini') as (typeof SINGLE)[number];
        expect(singleFileBytes(fresh, gemini).bytes).not.toBe(42);
    });
});
