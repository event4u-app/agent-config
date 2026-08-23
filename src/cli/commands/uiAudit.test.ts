/**
 * E2.1 / E2.3 behaviour. The pure core (`buildArtefact`, `staleness`) is
 * exercised directly so every branch is reachable without a tree on disk; the
 * filesystem path is covered by the CLI run recorded in the commit message.
 */
import { describe, expect, it } from 'vitest';

import { COVERAGE_BUCKETS, buildArtefact, staleness } from './uiAudit.js';

const NOW = '2026-08-23T00:00:00.000Z';
const build = (files: Array<readonly [string, string]>) => buildArtefact('.', files, NOW);

describe('E2.1 — the artefact shape the work engine already expects', () => {
    it('emits the state.ui_audit keys the dispatcher routes on', () => {
        const a = build([['components/Button.tsx', 'export function Button() { return null; }']]);
        expect(a).toMatchObject({ schema: 1, generated_at: NOW });
        for (const k of ['components_found', 'greenfield', 'audit_path']) expect(a).toHaveProperty(k);
    });

    it('shares ONE coverage vocabulary with the work engine instead of copying it', () => {
        expect([...COVERAGE_BUCKETS]).toEqual(['honoured', 'translated', 'flagged']);
    });

    it('is non-empty on a real component', () => {
        const a = build([['components/Card.tsx', 'export const Card = () => null;\nexport function Inner() {}']]);
        expect(a.components_found).toHaveLength(1);
        expect(a.primitives).toEqual(['Card', 'Inner']);
        expect(a.greenfield).toBe(false);
    });

    it('classifies by surface kind', () => {
        const a = build([
            ['components/Button.tsx', 'export const Button = () => null;'],
            ['app.css', ':root { --x: 1px; }'],
            ['resources/views/index.blade.php', '<div></div>'],
            ['pages/home.tsx', 'export default function Home() {}'],
        ]);
        expect(a.components_found.map((c) => c.kind).sort()).toEqual(['component', 'page', 'style', 'view']);
    });

    it('excludes a non-UI file — pages/api/ is excluded twice over', () => {
        const a = build([['pages/api/export.ts', 'export default function h() {}']]);
        expect(a.components_found).toHaveLength(0);
        expect(a.greenfield).toBe(true);
    });
});

describe('greenfield is the absence of a UI SURFACE, not of a DESIGN.md', () => {
    it('cases/greenfield: no UI file at all', () => {
        expect(build([['.gitkeep', '']]).greenfield).toBe(true);
        expect(build([['.gitkeep', '']]).audit_path).toBe('greenfield');
    });

    it('A1.3: a coherent incumbent with NO DESIGN.md is not greenfield', () => {
        const a = build([['report.css', '.report { font-family: "IBM Plex Sans", system-ui; color: #14181d; }']]);
        expect(a.greenfield).toBe(false);
        expect(a.audit_path).toBe('high_confidence');
    });
});

describe('coherence has more than one shape', () => {
    // Running the command on the corpus is what produced these three cases: the
    // original single heuristic (>=3 tokens or a marker) called
    // `no-design-md-coherent-incumbent` ambiguous, because that fixture declares
    // no custom property at all. A1.3 consumes `coherent`, so the false negative
    // would have become a wrong `change_intent` downstream.
    it('token declarations are one signal', () => {
        const a = build([['t.css', ':root { --a: 1px; --b: 2px; --c: 3px; }']]);
        expect(a.audit_path).toBe('high_confidence');
        expect(a.coherence_signals).toContain('3 declared tokens');
    });

    it('a design-system marker is another', () => {
        const a = build([
            ['components/ui/button.tsx', 'export const Button = () => null;'],
            ['DESIGN.md', '# DESIGN'],
        ]);
        expect(a.coherence_signals.join(' ')).toMatch(/design-system marker/);
    });

    it('a single dominant type family is the third, and the one tokens miss', () => {
        const a = build([['report.css', '.a { font-family: "IBM Plex Sans", system-ui, sans-serif; }']]);
        expect(a.coherence_signals).toEqual(['single type family: ibm plex sans']);
        expect(a.audit_path).toBe('high_confidence');
    });

    it('two competing families are NOT a coherence signal', () => {
        const a = build([
            ['a.css', '.a { font-family: Fraunces, serif; }'],
            ['b.css', '.b { font-family: Inter, sans-serif; }'],
        ]);
        expect(a.coherence_signals).toEqual([]);
        expect(a.audit_path).toBe('ambiguous');
    });

    it('a lone utility-classed component is ambiguous, not coherent', () => {
        // The negative that keeps the signal honest: one Tailwind-classed row is
        // not evidence of a system.
        const a = build([['OrderRow.jsx', 'export function OrderRow() { return <tr className="px-3" />; }']]);
        expect(a.audit_path).toBe('ambiguous');
    });
});

describe('E2.3 — Tier-1 staleness on data already opened', () => {
    const declared = new Set(['--ink-900', '--accent-600']);

    it('reports a token named in DESIGN.md that no UI file declares', () => {
        const s = staleness([['DESIGN.md', 'Tokens: `--ink-900`, `--gone-600`']], declared);
        expect(s).toHaveLength(1);
        expect(s[0]).toMatchObject({ document: 'DESIGN.md', token: '--gone-600' });
    });

    it('is silent when every named token exists', () => {
        expect(staleness([['DESIGN.md', 'Tokens: `--ink-900`, `--accent-600`']], declared)).toEqual([]);
    });

    it('reads PRODUCT.md too, and nothing else', () => {
        expect(staleness([['PRODUCT.md', '`--nope`']], declared)).toHaveLength(1);
        expect(staleness([['README.md', '`--nope`']], declared)).toEqual([]);
    });

    it('reports and never repairs — the entry carries a reason, not a patch', () => {
        const s = staleness([['DESIGN.md', '`--gone`']], declared);
        expect(s[0]!.reason).toMatch(/declared by no UI file/);
        expect(s[0]).not.toHaveProperty('fix');
    });
});

describe('graft 2 on the audit artefact', () => {
    it('a clean scan is verified', () => {
        expect(build([['a.css', ':root{--a:1px}']]).verification).toBe('verified');
    });
});
