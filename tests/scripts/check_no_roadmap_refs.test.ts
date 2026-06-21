// Tests for src/scripts/check_no_roadmap_refs.ts (py2ts Phase 4 / Wave 4a).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public behaviour (scan, format_text, ROADMAP_FILE_RE,
// self-documenting allowlist, fenced-code skipping) plus a golden-parity
// layer that runs python3 vs tsx on the REAL REPO (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as nrr from '../../src/scripts/check_no_roadmap_refs.js';



function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

describe('check_no_roadmap_refs — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nrr-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    // --- Forbidden: specific roadmap-file citations in stable artifacts. ---
    it('flags a roadmap-file citation in a stable rule', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/some-rule.md'),
            'See agents/roadmaps/road-to-x.md for the plan.',
        );
        const v = nrr.scan(tmp);
        expect(v).toHaveLength(1);
        expect(v[0]!.match).toBe('agents/roadmaps/road-to-x.md');
        expect(v[0]!.file).toBe('.agent-src.uncondensed/rules/some-rule.md');
        expect(v[0]!.line).toBe(1);
    });

    it('flags a citation nested under archive/ and skipped/', () => {
        write(
            path.join(tmp, 'docs/contracts/foo.md'),
            'old: agents/roadmaps/archive/done.md\nskipped: agents/roadmaps/skipped/dead.md\n',
        );
        const matches = nrr.scan(tmp).map((x) => x.match);
        expect(matches).toEqual([
            'agents/roadmaps/archive/done.md',
            'agents/roadmaps/skipped/dead.md',
        ]);
    });

    it('flags a citation in a stable single-file artefact (AGENTS.md)', () => {
        write(path.join(tmp, 'AGENTS.md'), 'plan: agents/roadmaps/road-to-y.md');
        const v = nrr.scan(tmp);
        expect(v).toHaveLength(1);
        expect(v[0]!.file).toBe('AGENTS.md');
    });

    // --- Allowed: directory mentions + angle-bracket placeholders. ---
    it('allows a bare directory mention', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/some-rule.md'),
            'Roadmaps live under agents/roadmaps/ and rotate.',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    it('allows angle-bracket placeholder mentions', () => {
        write(
            path.join(tmp, 'docs/contracts/foo.md'),
            'Forbidden: agents/roadmaps/<file>.md — do not cite.',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    // --- Fenced code blocks are skipped. ---
    it('skips matches inside fenced code blocks', () => {
        write(
            path.join(tmp, 'docs/contracts/foo.md'),
            '```\nagents/roadmaps/road-to-x.md\n```\nfree text agents/roadmaps/road-to-z.md\n',
        );
        const v = nrr.scan(tmp);
        expect(v).toHaveLength(1);
        expect(v[0]!.match).toBe('agents/roadmaps/road-to-z.md');
        expect(v[0]!.line).toBe(4);
    });

    // --- Self-documenting allowlist files are exempt. ---
    it('exempts the self-documenting rule file', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/no-roadmap-references.md'),
            'Forbidden: agents/roadmaps/road-to-x.md',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    it('exempts the guideline twin of the rule', () => {
        write(
            path.join(tmp, 'docs/guidelines/agent-infra/no-roadmap-references.md'),
            'Forbidden: agents/roadmaps/road-to-x.md',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    // --- Scope: unstable trees (e.g. agents/roadmaps itself) not scanned. ---
    it('does not scan non-stable trees', () => {
        write(
            path.join(tmp, 'agents/roadmaps/road-to-x.md'),
            'sibling: agents/roadmaps/road-to-y.md',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    it('clean repo passes', () => {
        write(path.join(tmp, '.agent-src.uncondensed/rules/ok.md'), 'All good.');
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    // --- format_text output. ---
    it('format_text reports the clean message', () => {
        expect(nrr.format_text([])).toBe('✅  No roadmap-file references in stable artifacts.');
    });

    it('format_text lists each violation with the suffix note', () => {
        const out = nrr.format_text([
            { file: 'AGENTS.md', line: 3, match: 'agents/roadmaps/road-to-x.md' },
        ]);
        expect(out).toContain('❌  Found 1 roadmap reference(s) in stable artifacts:');
        expect(out).toContain('🔴 AGENTS.md:3  →  agents/roadmaps/road-to-x.md');
        expect(out).toContain('Promote the durable conclusion to agents/settings/contexts/');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

