// Tests for src/scripts/lint_legal_pack.ts (road-to-legal-pack Phase 1).
//
// Differential over the public `lintLegalPack(skillsDir)` helper: the real repo
// must be clean, and a synthetic non-compliant legal-pack skill must be caught.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    lintLegalPack,
    legalPromotionViolations,
    legalFloorReferenceViolations,
} from '../../src/scripts/lint_legal_pack.js';

const LAB_PACK = '- id: legal-review-prep\n  surface_tier: lab\n  trust_level_default: experimental\n  default_install: false\n';
const PROMOTED_PACK = '- id: legal-review-prep\n  surface_tier: core\n  trust_level_default: professional\n  default_install: true\n';
const NO_REVIEW = '_Attorney framing review: not yet performed._';
const REVIEWED = 'Framing reviewed by Erika Mustermann, Rechtsanwältin, 2026-07-01.';

describe('lint_legal_pack — promotion gate', () => {
    it('lab-tier pack needs no framing review', () => {
        expect(legalPromotionViolations(LAB_PACK, NO_REVIEW)).toEqual([]);
    });
    it('promoted pack without a recorded framing review fails', () => {
        const v = legalPromotionViolations(PROMOTED_PACK, NO_REVIEW);
        expect(v.some((x) => x.rule === 'promotion-gate')).toBe(true);
    });
    it('promoted pack WITH a recorded framing review passes', () => {
        expect(legalPromotionViolations(PROMOTED_PACK, REVIEWED)).toEqual([]);
    });
});

describe('lint_legal_pack — floor reference gate (D7)', () => {
    // Build a tiny shipped-projection tree: <root>/dist/agent-src/rules is the
    // resolution base; LEGAL_NOTICE.md sits at <root> (../../../ from rules),
    // and a sibling skill at <root>/dist/agent-src/skills/.
    function makeProjection(): { root: string; projectedDir: string } {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-ref-'));
        tmpDirs.push(root);
        const projectedDir = path.join(root, 'dist', 'agent-src', 'rules');
        fs.mkdirSync(projectedDir, { recursive: true });
        fs.writeFileSync(path.join(root, 'LEGAL_NOTICE.md'), 'notice', 'utf-8');
        const skillDir = path.join(root, 'dist', 'agent-src', 'skills', 'contracts-cognition');
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# skill', 'utf-8');
        return { root, projectedDir };
    }

    it('passes when every link resolves from the shipped projection', () => {
        const { projectedDir } = makeProjection();
        const text =
            'See [`LEGAL_NOTICE.md`](../../../LEGAL_NOTICE.md) and ' +
            '[`contracts-cognition`](../skills/contracts-cognition/SKILL.md).';
        expect(legalFloorReferenceViolations(text, projectedDir, 'rules/floor.md')).toEqual([]);
    });

    it('flags a link with the wrong relative depth (the 7.5.0 bug shape)', () => {
        const { projectedDir } = makeProjection();
        // `../../LEGAL_NOTICE.md` would NOT resolve from the projection (only
        // `../../../` does) — exactly the broken-path class this gate guards.
        const text = 'See [`LEGAL_NOTICE.md`](../../LEGAL_NOTICE.md).';
        const v = legalFloorReferenceViolations(text, projectedDir, 'rules/floor.md');
        expect(v.some((x) => x.rule === 'floor-reference')).toBe(true);
    });

    it('flags an entirely missing target', () => {
        const { projectedDir } = makeProjection();
        const text = '[gone](../skills/does-not-exist/SKILL.md)';
        const v = legalFloorReferenceViolations(text, projectedDir, 'rules/floor.md');
        expect(v.some((x) => x.rule === 'floor-reference')).toBe(true);
    });

    it('skips external URLs and in-page anchors', () => {
        const { projectedDir } = makeProjection();
        const text = '[web](https://example.com) and [anchor](#section) and [mail](mailto:a@b.c)';
        expect(legalFloorReferenceViolations(text, projectedDir, 'rules/floor.md')).toEqual([]);
    });

    it('ignores a fragment suffix on an otherwise-valid path', () => {
        const { projectedDir } = makeProjection();
        const text = '[s](../skills/contracts-cognition/SKILL.md#anchor)';
        expect(legalFloorReferenceViolations(text, projectedDir, 'rules/floor.md')).toEqual([]);
    });
});

const tmpDirs: string[] = [];

function makeSkill(root: string, name: string, fm: string, body: string): void {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\n${fm}\n---\n${body}`, 'utf-8');
}

afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('lint_legal_pack — real repo', () => {
    it('the shipped legal pack is compliant (0 violations)', () => {
        expect(lintLegalPack()).toEqual([]);
    });
});

describe('lint_legal_pack — synthetic fixtures', () => {
    it('flags a legal-pack skill missing the attorney-review line', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-lint-'));
        tmpDirs.push(root);
        makeSkill(root, 'bad-skill', 'packs:\n  - legal-review-prep\ncouncil_depth: deep', '# bad\nJurisdiction: EU\nno disclaimer here\n');
        const v = lintLegalPack(root);
        expect(v.some((x) => x.rule === 'disclaimer-presence')).toBe(true);
    });

    it('flags a legal-pack skill missing the Jurisdiction tag', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-lint-'));
        tmpDirs.push(root);
        makeSkill(root, 'bad-skill', 'packs:\n  - legal-review-prep\ncouncil_depth: deep', '# bad\nAttorney review required on material use\n');
        const v = lintLegalPack(root);
        expect(v.some((x) => x.rule === 'jurisdiction-tag')).toBe(true);
    });

    it('flags a legal-pack skill missing council_depth: deep', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-lint-'));
        tmpDirs.push(root);
        makeSkill(root, 'no-council', 'packs:\n  - legal-review-prep', '# x\nJurisdiction: EU\n> Attorney review required on material use.\n');
        const v = lintLegalPack(root);
        expect(v.some((x) => x.rule === 'council-depth')).toBe(true);
    });

    it('ignores non-legal-pack skills entirely', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-lint-'));
        tmpDirs.push(root);
        makeSkill(root, 'other', 'packs:\n  - finance-basic', '# other\nno legal strings\n');
        expect(lintLegalPack(root)).toEqual([]);
    });

    it('passes a compliant legal-pack skill', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-lint-'));
        tmpDirs.push(root);
        makeSkill(root, 'good', 'packs:\n  - legal-review-prep\ncouncil_depth: deep', '# good\nJurisdiction: DE\n> Attorney review required on material use.\n');
        expect(lintLegalPack(root)).toEqual([]);
    });

    it('flags definitive legal language in a skill body', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-lint-'));
        tmpDirs.push(root);
        makeSkill(root, 'def', 'packs:\n  - legal-review-prep\ncouncil_depth: deep', '# d\nJurisdiction: EU\nAttorney review required on material use\nThis contract is valid and you are required to sign.\n');
        const v = lintLegalPack(root);
        expect(v.some((x) => x.rule === 'definitive-language')).toBe(true);
    });

    it('does NOT flag definitive phrases inside negative-example/guidance lines', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-lint-'));
        tmpDirs.push(root);
        makeSkill(root, 'guide', 'packs:\n  - legal-review-prep\ncouncil_depth: deep', '# g\nJurisdiction: DE\nAttorney review required on material use\nDo NOT say "this contract is valid"; instead flag it for review.\n');
        const v = lintLegalPack(root);
        expect(v.some((x) => x.rule === 'definitive-language')).toBe(false);
    });

    it('flags an invalid freshness_window shape when declared', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-lint-'));
        tmpDirs.push(root);
        makeSkill(root, 'fresh', 'packs:\n  - legal-review-prep\ncouncil_depth: deep\nfreshness_window: "soon"', '# f\nJurisdiction: EU\nAttorney review required on material use\n');
        const v = lintLegalPack(root);
        expect(v.some((x) => x.rule === 'freshness')).toBe(true);
    });
});
