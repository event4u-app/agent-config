/**
 * E1.1 / E1.2 / E1.3 behaviour, on the pure core.
 *
 * The severity contract is the load-bearing assertion here: Risk 1 of the parent
 * roadmap is that ONE false block on clean UI makes an operator turn the carrier
 * off for good — which is the OFF state the 0.0 % measurement already recorded.
 * So "P1-P3 never block" is tested on both slots, in both directions.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import {
    HANDOVER_TRIGGERS,
    P0_FLOOR_IDS,
    conformanceVerdict,
    decide,
    handoverTouched,
    isUiSurface,
    isUiTrivial,
    recordAuditDischarge,
    render,
    targetPath,
    type Finding,
} from '../../src/scripts/hooks/design_pass_hook.js';
import { collectInputs } from '../../src/scripts/_lib/probe_inputs.js';
import { readDischarged } from '../../src/scripts/_lib/obligations.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const f = (severity: Finding['severity'], catalogId = 'Q1', line = 1, file = 'components/A.tsx'): Finding => ({
    file,
    severity,
    catalogId,
    rule: `slop-${catalogId.toLowerCase()}`,
    line,
    message: `${catalogId} finding`,
});
const none = new Set<string>();

describe('E1.1 — the post pass delivers and never blocks', () => {
    it('a P0 on post_tool_use is delivered, not blocked', () => {
        const r = decide('post_tool_use', [f('P0')], [], none, true);
        expect(r.findings).toHaveLength(1);
        expect(r.blocked).toEqual([]);
    });

    it('P1, P2 and P3 are delivered and never blocked', () => {
        const r = decide('post_tool_use', [f('P1'), f('P2', 'V1', 2), f('P3', 'L4', 3)], [], none, true);
        expect(r.findings).toHaveLength(3);
        expect(r.blocked).toEqual([]);
    });

    it('a clean rewrite of the same file yields nothing new', () => {
        const first = decide('post_tool_use', [f('P2', 'V1')], [], none, true);
        const seen = new Set(first.findings.map((x) => `${x.file}::${x.rule}::${x.line}`));
        expect(decide('post_tool_use', [f('P2', 'V1')], [], seen, true).findings).toEqual([]);
    });
});

describe('E1.3 — P0 is a stop-slot verdict, and only P0', () => {
    it('a P0 at stop is computed as blocked', () => {
        const r = decide('stop', [f('P0')], [], none, true);
        expect(r.blocked).toHaveLength(1);
    });

    it('the verdict is REPORTED as would-block, never claimed as enforced', () => {
        // The concern is severity: advisory, and the dispatcher downgrades an
        // advisory EXIT_BLOCK. Rendering "must be fixed" while the transport
        // discards the refusal is the inert-block defect run-continuation
        // already hit once. The wording carries the limit instead.
        const out = render(decide('stop', [f('P0')], [], none, true));
        expect(out).toMatch(/WOULD BLOCK at stop/);
        expect(out).toMatch(/reported, not enforced/);
    });

    it('a P2-only fixture never blocks at stop', () => {
        expect(decide('stop', [f('P2', 'V1'), f('P3', 'L4')], [], none, true).blocked).toEqual([]);
    });

    it('the P0 set is the objective floors, not aesthetic tells', () => {
        // Q* ids belong to lint_design_quality. An aesthetic tell (V*, T*, L*)
        // must never appear here, or the block becomes a taste judgement.
        expect([...P0_FLOOR_IDS]).toEqual(['Q1', 'Q2', 'Q5', 'Q6']);
        for (const id of P0_FLOOR_IDS) expect(id).toMatch(/^Q\d$/);
    });

    it('an already-surfaced P0 does not block twice', () => {
        const seen = new Set(['components/A.tsx::slop-q1::1']);
        expect(decide('stop', [f('P0')], [], seen, true).blocked).toEqual([]);
    });
});

describe('E1.2 — the stop pass is scoped to the files touched', () => {
    it('dedupes against the post pass by file::rule::line', () => {
        const seen = new Set(['components/A.tsx::slop-v1::7']);
        const r = decide('stop', [f('P2', 'V1', 7), f('P2', 'V1', 9)], [], seen, true);
        expect(r.findings.map((x) => x.line)).toEqual([9]);
    });
});

describe('graft 2 — a pass that could not run says so', () => {
    it('no render artefact degrades the verdict and names why', () => {
        const r = decide('stop', [], [], none, false);
        expect(r.verification).toBe('degraded');
        expect(r.degradation_reason).toMatch(/ui:render/);
    });

    it('a render artefact present is verified with no reason', () => {
        const r = decide('stop', [], [], none, true);
        expect(r.verification).toBe('verified');
        expect(r.degradation_reason).toBeUndefined();
    });

    it('degradation is reported even when there are zero findings', () => {
        // The silent-pass failure mode: nothing found AND nothing checked must
        // not look the same as nothing found after a full check.
        expect(render(decide('stop', [], [], none, false))).toMatch(/verification: degraded/);
    });
});

describe('E2.2 — the audit-freshness line', () => {
    it('a missing artefact is reported with the command that fixes it', () => {
        const out = render(decide('post_tool_use', [], ['components/A.tsx'], none, true));
        expect(out).toMatch(/no ui-audit\.json newer than components\/A\.tsx/);
        expect(out).toMatch(/agent-config ui:audit/);
    });
});

describe('ui-trivial — all FIVE conditions, not the four the prose carries', () => {
    const base = { files: 1, changedLines: 5, newComponent: false, newState: false, newDependency: false };
    it('the boundary case is trivial', () => {
        expect(isUiTrivial(base)).toBe(true);
    });
    it.each([
        ['files', { ...base, files: 2 }],
        ['changedLines', { ...base, changedLines: 6 }],
        ['newComponent', { ...base, newComponent: true }],
        ['newState', { ...base, newState: true }],
        ['newDependency', { ...base, newDependency: true }],
    ])('%s over the line is not trivial', (_name, shape) => {
        expect(isUiTrivial(shape)).toBe(false);
    });
});

describe('surface detection uses the shared predicate', () => {
    it.each([
        ['components/Button.tsx', true],
        ['resources/views/x.blade.php', true],
        ['app.css', true],
        ['pages/api/export.ts', false],
        ['src/server/db.ts', false],
    ])('%s -> %s', (p, want) => {
        expect(isUiSurface(p)).toBe(want);
    });
});

describe('payload extraction tolerates host key variance', () => {
    it.each([
        [{ tool_input: { file_path: 'a.tsx' } }, 'a.tsx'],
        [{ input: { path: 'b.css' } }, 'b.css'],
        [{ filePath: 'c.vue' }, 'c.vue'],
        [{ tool_input: { target_file: 'd.svelte' } }, 'd.svelte'],
    ])('%j -> %s', (payload, want) => {
        expect(targetPath(payload)).toBe(want);
    });

    it('returns null when no path key is present', () => {
        expect(targetPath({ tool_input: { content: 'x' } })).toBeNull();
        expect(targetPath(null)).toBeNull();
    });
});

describe('the audit discharge — the decision existed, only the write was missing', () => {
    const withSession = (id: string | null, fn: () => void): void => {
        const prev = process.env['CLAUDE_CODE_SESSION_ID'];
        if (id === null) delete process.env['CLAUDE_CODE_SESSION_ID'];
        else process.env['CLAUDE_CODE_SESSION_ID'] = id;
        try {
            fn();
        } finally {
            if (prev === undefined) delete process.env['CLAUDE_CODE_SESSION_ID'];
            else process.env['CLAUDE_CODE_SESSION_ID'] = prev;
        }
    };

    let root = '';
    const fresh = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'discharge-'));

    it('records a discharge when every touched target has a fresh audit', () => {
        root = fresh();
        withSession('s1', () => recordAuditDischarge(root, ['components/A.tsx'], []));
        expect(readDischarged(root, 's1').map((r) => r.rule)).toEqual(['ui-audit-gate']);
        expect(readDischarged(root, 's1')[0]?.by).toBe('design-pass');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('records NOTHING on a partial pass', () => {
        // The obligation is about the surfaces this turn wrote, not a quorum
        // of them — one stale target means the audit was not done.
        root = fresh();
        withSession('s1', () =>
            recordAuditDischarge(root, ['components/A.tsx', 'components/B.tsx'], [
                'components/B.tsx',
            ]),
        );
        expect(readDischarged(root, 's1')).toEqual([]);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('records nothing when no target was touched at all', () => {
        root = fresh();
        withSession('s1', () => recordAuditDischarge(root, [], []));
        expect(readDischarged(root, 's1')).toEqual([]);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('records nothing, and does not throw, with no session id', () => {
        root = fresh();
        withSession(null, () =>
            expect(() => recordAuditDischarge(root, ['components/A.tsx'], [])).not.toThrow(),
        );
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('is idempotent across repeated fires in one turn', () => {
        root = fresh();
        withSession('s1', () => {
            recordAuditDischarge(root, ['components/A.tsx'], []);
            recordAuditDischarge(root, ['components/A.tsx'], []);
            recordAuditDischarge(root, ['components/A.tsx'], []);
        });
        expect(readDischarged(root, 's1')).toHaveLength(1);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('never throws when the ledger cannot be written', () => {
        root = fresh();
        const wall = path.join(root, 'wall');
        fs.writeFileSync(wall, 'not a directory');
        withSession('s1', () =>
            expect(() => recordAuditDischarge(wall, ['components/A.tsx'], [])).not.toThrow(),
        );
        fs.rmSync(root, { recursive: true, force: true });
    });
});

describe('the ui-conformance shadow mount', () => {
    const emptyRoot = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'design-pass-'));
    const withArtefact = (body: unknown): string => {
        const dir = emptyRoot();
        const state = path.join(dir, 'agents', 'runtime', 'state');
        fs.mkdirSync(state, { recursive: true });
        fs.writeFileSync(
            path.join(state, 'ui-conformance.json'),
            typeof body === 'string' ? body : JSON.stringify(body),
        );
        return dir;
    };

    it('reports an absent artefact as absent, and does not speak up on its own', () => {
        // 5.2, second half: a run without the lane present completes with no error.
        const v = conformanceVerdict(emptyRoot());
        expect(v.line).toMatch(/absent/);
        expect(v.line).toMatch(/Absent is not clean/);
        // Risk 1: a line on every clean UI write in a repository that never runs
        // the probe is the noise that gets a carrier switched off for good.
        expect(v.noteworthy).toBe(false);
    });

    it('surfaces behavioural findings the static pass cannot see', () => {
        const v = conformanceVerdict(
            withArtefact({
                structure_gate: 'passed',
                findings: [{ dimension: 'interaction' }, { dimension: 'viewport_matrix' }],
                dimensions: [
                    { dimension: 'interaction', status: 'exercised', findings: 1 },
                    { dimension: 'viewport_matrix', status: 'exercised', findings: 1 },
                ],
            }),
        );
        expect(v.noteworthy).toBe(true);
        expect(v.line).toMatch(/2 behavioural finding/);
        expect(v.line).toMatch(/never enforced/);
    });

    it('carries a not-applicable row with its reason rather than a zero', () => {
        const v = conformanceVerdict(
            withArtefact({
                structure_gate: 'passed',
                findings: [],
                dimensions: [
                    {
                        dimension: 'interaction',
                        status: 'not_applicable',
                        findings: null,
                        reason: 'no browser binary',
                    },
                ],
            }),
        );
        expect(v.line).toMatch(/not applicable: interaction \(no browser binary\)/);
        expect(v.line).not.toMatch(/interaction=0/);
    });

    it('reports an unreadable artefact rather than ignoring it', () => {
        const v = conformanceVerdict(withArtefact('{ not json'));
        expect(v.noteworthy).toBe(true);
        expect(v.line).toMatch(/unreadable/);
    });

    it('an absent artefact becomes noteworthy when a handover was touched this turn', () => {
        // 3.1. The same absence, two readings: unremarkable on an ordinary UI
        // write, worth one line on a turn that actually ported a handover.
        const root = emptyRoot();
        const quiet = conformanceVerdict(root);
        const loud = conformanceVerdict(root, { handoverDetected: true });
        expect(quiet.noteworthy).toBe(false);
        expect(loud.noteworthy).toBe(true);
        // "exactly one" — the absent verdict stays a single line either way.
        expect(loud.line.split('\n')).toHaveLength(1);
        expect(loud.line).toMatch(/handover/i);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('appends the verdict to the render without reaching any decision', () => {
        // 5.2, first half: the block path stays unreachable. The verdict renders
        // alongside a P0 stop verdict and changes neither `blocked` nor anything
        // the severity contract is written against.
        const result = decide('stop', [f('P0')], [], none, true);
        const text = render(result, 'ui-conformance: 3 behavioural finding(s)');
        expect(text).toMatch(/ui-conformance: 3 behavioural finding/);
        expect(result.blocked).toHaveLength(1);
        expect(text.indexOf('ui-conformance')).toBeGreaterThan(text.indexOf('verification:'));
        // And it is strictly opt-in at the call site: no verdict, no line.
        expect(render(result).includes('ui-conformance')).toBe(false);
    });
});

/**
 * Phase 2 and Phase 3 of `road-to-probe-evidence-that-knows-its-inputs`.
 *
 * The reader recomputes the digests the probe recorded and reports `stale` when
 * they moved. Every assertion here runs on a host with no browser binaries, and
 * one of them says so explicitly — deciding staleness is a file comparison, and
 * a reader that needed a browser to make it would be useless in exactly the
 * session that wants the answer.
 */
describe('the reader says stale, and says nothing else', () => {
    const SURFACE = path.join(ROOT_DIR, 'tests', 'design-artifacts', 'fixtures', 'ui-conformance');

    /** A root carrying a copy of the fixture surfaces and an artefact over them. */
    function rootWithProbeRun(overrides: Record<string, unknown> = {}): {
        root: string;
        target: string;
    } {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'design-pass-inputs-'));
        for (const variant of ['reference', 'variant-defects']) {
            fs.cpSync(path.join(SURFACE, variant), path.join(root, 'ui', variant), { recursive: true });
        }
        const targetEntry = path.join(root, 'ui', 'variant-defects', 'index.html');
        const inputs = collectInputs(targetEntry, path.join(root, 'ui', 'reference', 'index.html'));
        const state = path.join(root, 'agents', 'runtime', 'state');
        fs.mkdirSync(state, { recursive: true });
        fs.writeFileSync(
            path.join(state, 'ui-conformance.json'),
            JSON.stringify({
                schema: 'ui-conformance/v1',
                inputs,
                structure_gate: 'passed',
                findings: [{ dimension: 'interaction' }, { dimension: 'interaction' }, { dimension: 'structure' }],
                dimensions: [
                    { dimension: 'interaction', status: 'exercised', findings: 2 },
                    { dimension: 'structure', status: 'exercised', findings: 1 },
                ],
                ...overrides,
            }),
        );
        return { root, target: targetEntry };
    }

    it('unmoved inputs read as unchanged, and the findings count is still reported', () => {
        const { root } = rootWithProbeRun();
        try {
            const v = conformanceVerdict(root);
            expect(v.line).toMatch(/3 behavioural finding/);
            expect(v.line).toMatch(/inputs: unchanged/);
            expect(v.line).not.toMatch(/stale/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('2.1 — an edited target makes the line read stale, and withholds the count', () => {
        const { root, target } = rootWithProbeRun();
        try {
            const css = path.join(path.dirname(target), 'styles.css');
            fs.writeFileSync(css, `${fs.readFileSync(css, 'utf-8')}\n/* edited after the probe ran */\n`);
            const v = conformanceVerdict(root);
            expect(v.noteworthy).toBe(true);
            expect(v.line).toMatch(/stale/);
            expect(v.line).toMatch(/target/);
            // THE OTHER HALF, and the reason the step names it: a count measured
            // against inputs that have since moved is the misleading part, so the
            // pre-change behaviour is asserted ABSENT rather than merely
            // accompanied by a warning.
            expect(v.line).not.toMatch(/behavioural finding/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('a touch that changes no byte does not report stale — decision D1', () => {
        const { root, target } = rootWithProbeRun();
        try {
            const future = new Date(Date.now() + 60_000);
            fs.utimesSync(target, future, future);
            const v = conformanceVerdict(root);
            expect(v.line).not.toMatch(/stale/);
            expect(v.line).toMatch(/3 behavioural finding/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('resolves a recorded relative path against the root it is reading', () => {
        const { root, target } = rootWithProbeRun();
        try {
            // Rewrite the recorded paths to root-relative, which is the shape a
            // probe run from the project root actually writes.
            const artefact = path.join(root, 'agents', 'runtime', 'state', 'ui-conformance.json');
            const a = JSON.parse(fs.readFileSync(artefact, 'utf-8')) as Record<string, never>;
            const inputs = a['inputs'] as unknown as Record<string, { path: string | null }>;
            for (const key of ['target', 'reference', 'declarations']) {
                const rec = inputs[key]!;
                if (rec.path) rec.path = path.relative(root, rec.path);
            }
            fs.writeFileSync(artefact, JSON.stringify(a));

            expect(conformanceVerdict(root).line).toMatch(/inputs: unchanged/);
            const css = path.join(path.dirname(target), 'styles.css');
            fs.writeFileSync(css, `${fs.readFileSync(css, 'utf-8')}\n/* moved */\n`);
            expect(conformanceVerdict(root).line).toMatch(/stale/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('2.2 — an artefact predating the inputs field reads unknown, not stale and not fresh', () => {
        const { root } = rootWithProbeRun({ inputs: undefined });
        try {
            const artefact = path.join(root, 'agents', 'runtime', 'state', 'ui-conformance.json');
            const a = JSON.parse(fs.readFileSync(artefact, 'utf-8')) as Record<string, unknown>;
            delete a['inputs'];
            fs.writeFileSync(artefact, JSON.stringify(a));

            const v = conformanceVerdict(root);
            expect(v.line).toMatch(/inputs: unknown/);
            expect(v.line).not.toMatch(/stale/);
            expect(v.line).not.toMatch(/inputs: unchanged/);
            // Risk 1: treating absence as a mismatch would report stale for every
            // artefact that existed before this change.
            expect(v.line).toMatch(/3 behavioural finding/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('2.3 — no browser runtime is reachable from the reader', () => {
        // The roadmap's own verify line. Asserted over the source of the reader
        // and of the module it delegates the hashing to, because an import added
        // to either would put a browser on the stale path.
        for (const rel of [
            path.join('src', 'scripts', 'hooks', 'design_pass_hook.ts'),
            path.join('src', 'scripts', '_lib', 'probe_inputs.ts'),
        ]) {
            const src = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8');
            const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]!);
            for (const spec of imports) {
                expect(spec, `${rel} imports ${spec}`).not.toMatch(/playwright|puppeteer|chromium|webdriver/i);
            }
        }
    });

    it('2.3 — the stale decision runs with no browser binaries installed', () => {
        // Positive half: not "no import exists" but "the verdict is reached".
        // This process installs no browser, so reaching a verdict IS the evidence.
        const { root, target } = rootWithProbeRun();
        try {
            fs.writeFileSync(target, `${fs.readFileSync(target, 'utf-8')}\n<!-- moved -->\n`);
            expect(conformanceVerdict(root).line).toMatch(/stale/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('3.2 — a stale verdict changes nothing the pass decides', () => {
        const { root, target } = rootWithProbeRun();
        try {
            fs.writeFileSync(target, `${fs.readFileSync(target, 'utf-8')}\n<!-- moved -->\n`);
            const v = conformanceVerdict(root);
            // `decide` takes no conformance argument at all — the block path
            // cannot consult it, which is stronger than asserting it does not.
            const result = decide('stop', [f('P0')], [], none, true);
            expect(result.blocked).toHaveLength(1);
            expect(render(result, v.line)).toMatch(/stale/);
            expect(decide.length).toBe(5);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('3.1 — the handover trigger decides, and it is the shipped one', () => {
    it('matches the handover filenames the design-fidelity rule declares', () => {
        expect(handoverTouched(['src/pages/Home.tsx'])).toBe(false);
        expect(handoverTouched(['design.html'])).toBe(true);
        expect(handoverTouched(['handoff/2026-09-checkout.design.html'])).toBe(true);
        expect(handoverTouched(['ToDo.dc.html'])).toBe(true);
        // A near miss in the direction the pattern opens: `*design.html` must not
        // become "any html", which would fire on every UI turn.
        expect(handoverTouched(['components/Card.html'])).toBe(false);
        expect(handoverTouched([])).toBe(false);
    });

    it('the trigger set is the rule\'s own, not a second copy that may drift', () => {
        const rule = fs.readFileSync(path.join(ROOT_DIR, 'src', 'rules', 'design-fidelity.md'), 'utf-8');
        const fm = /^---\n([\s\S]*?)\n---\n/.exec(rule);
        expect(fm, 'design-fidelity.md carries frontmatter').toBeTruthy();
        const declared = (yaml.load(fm![1]!) as { triggers?: Record<string, string>[] }).triggers ?? [];
        const fileBased = declared.filter((t) => 'file_pattern' in t || 'path_prefix' in t);
        // Equality in both directions: a trigger added to the rule and not here
        // is a handover this carrier goes silent on; one added here and not there
        // is a matcher this package does not actually ship.
        expect(HANDOVER_TRIGGERS).toStrictEqual(fileBased);
    });
});
