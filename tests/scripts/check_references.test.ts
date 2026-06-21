// Tests for src/scripts/check_references.ts (py2ts Phase 4 / Wave 4a).
//
// Three layers:
//   1. 1:1 port of tests/test_check_references_allowlist.py — the
//      content-class allowlist + docs/src path-root coverage.
//   2. 1:1 port of tests/test_check_references_memory.py — the YAML-memory
//      branch (scan_all over agents/memory).
//   3. Golden parity on the REAL REPO — python3 vs tsx, byte-identical
//      stdout/stderr/exit (skipped when python3 is absent).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as cr from '../../src/scripts/check_references.js';



function makeTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cr-'));
}

// ===========================================================================
// Port of test_check_references_allowlist.py
// ===========================================================================

const ARTIFACTS: cr.Artifacts = {
    skills: new Set(['real-skill']),
    rules: new Set(['real-rule']),
    commands: new Set(),
    guidelines: new Set(),
    personas: new Set(),
};

describe('check_references — content-class allowlist (port)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = makeTmp();
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function check(body: string): cr.BrokenRef[] {
        const md = path.join(tmp, 'doc.md');
        fs.writeFileSync(md, body, 'utf-8');
        return cr.check_file(md, ARTIFACTS, tmp);
    }

    function skillRuleRefs(broken: cr.BrokenRef[]): cr.BrokenRef[] {
        return broken.filter((b) => b.ref_type === 'skill' || b.ref_type === 'rule');
    }

    function pathRefs(broken: cr.BrokenRef[]): cr.BrokenRef[] {
        return broken.filter((b) => b.ref_type === 'path');
    }

    // --- allowlist classes pass (no false positives) ---
    it('execution-type enum passes', () => {
        const body =
            'The preview shows whether it is a `manual` skill or an `assisted` ' +
            'skill, and whether an `automated` skill needs a handler.\n';
        expect(skillRuleRefs(check(body))).toHaveLength(0);
    });

    it('pack identifier passes', () => {
        const body =
            'The sibling command declares four `pack-ai-video` skills, and the ' +
            '`pack-finance-basic` rule gates the disclosure footer.\n';
        expect(skillRuleRefs(check(body))).toHaveLength(0);
    });

    it('bare meta-qualifier passes', () => {
        const body =
            '`agent-status` is a `command` skill surface, not a `skill` rule — ' +
            'the `command` vs `skill` distinction matters.\n';
        expect(skillRuleRefs(check(body))).toHaveLength(0);
    });

    it('restored preview line passes', () => {
        const body =
            "Show the plain-language preview: the skill's execution type (a " +
            '`manual` skill renders **"instructional only"**; an `assisted` ' +
            'skill renders its proposed actions).\n';
        expect(skillRuleRefs(check(body))).toHaveLength(0);
    });

    it('restored roadmap line passes', () => {
        const body =
            'The sibling `/video:from-script` **already** declares four ' +
            "`pack-ai-video` skills and the repo's validator fails fast.\n";
        expect(skillRuleRefs(check(body))).toHaveLength(0);
    });

    it('real skill reference passes', () => {
        const body = 'Use the `real-skill` skill and the `real-rule` rule.\n';
        expect(skillRuleRefs(check(body))).toHaveLength(0);
    });

    // --- genuine broken references still fail (no over-allowlisting) ---
    it('unknown skill reference still fails', () => {
        const body = 'Use the `nonexistent-skill` skill for this.\n';
        const broken = skillRuleRefs(check(body));
        expect(
            broken.some((b) => b.ref === 'nonexistent-skill' && b.ref_type === 'skill'),
        ).toBe(true);
    });

    it('unknown rule reference still fails', () => {
        const body = 'This honours the `nonexistent-rule` rule.\n';
        const broken = skillRuleRefs(check(body));
        expect(
            broken.some((b) => b.ref === 'nonexistent-rule' && b.ref_type === 'rule'),
        ).toBe(true);
    });

    it('pack prefix does not mask unrelated unknown', () => {
        const body = 'Use the `packaging-helper` skill.\n';
        const broken = skillRuleRefs(check(body));
        expect(broken.some((b) => b.ref === 'packaging-helper')).toBe(true);
    });

    // --- structural guards on the allowlist itself ---
    it('every allowlist entry has a reason', () => {
        expect(cr.ALLOWLIST_PATTERNS.length).toBeGreaterThan(0);
        for (const entry of cr.ALLOWLIST_PATTERNS) {
            expect(entry.reason && entry.reason.trim()).toBeTruthy();
        }
    });

    it('is_allowlisted matches expected tokens', () => {
        expect(cr._is_allowlisted('manual')).toBe(true);
        expect(cr._is_allowlisted('assisted')).toBe(true);
        expect(cr._is_allowlisted('automated')).toBe(true);
        expect(cr._is_allowlisted('pack-ai-video')).toBe(true);
        expect(cr._is_allowlisted('command')).toBe(true);
        expect(cr._is_allowlisted('real-skill')).toBe(false);
        expect(cr._is_allowlisted('nonexistent-skill')).toBe(false);
        expect(cr._is_allowlisted('packaging-helper')).toBe(false);
    });

    // --- docs/ + src/ path-root coverage (Phase-0 step 7a guardrail) ---
    it('docs dead path fails', () => {
        const body = 'See the guide at `docs/nonexistent-guide.md` for details.\n';
        const broken = pathRefs(check(body));
        expect(broken.some((b) => b.ref.includes('docs/nonexistent-guide.md'))).toBe(true);
    });

    it('src dead path fails', () => {
        const body = 'Edit `src/agent-src/contexts/nonexistent-context.md` to change it.\n';
        const broken = pathRefs(check(body));
        expect(
            broken.some((b) => b.ref.includes('src/agent-src/contexts/nonexistent-context.md')),
        ).toBe(true);
    });

    it('docs existing path passes', () => {
        fs.mkdirSync(path.join(tmp, 'docs'));
        fs.writeFileSync(path.join(tmp, 'docs', 'real.md'), 'ok', 'utf-8');
        const body = 'See `docs/real.md`.\n';
        expect(pathRefs(check(body))).toHaveLength(0);
    });

    it('docs illustrative example allowlisted', () => {
        const body = 'Put auth docs in `docs/auth.md`, runbooks in `docs/runbooks/5xx.md`.\n';
        expect(pathRefs(check(body))).toHaveLength(0);
    });

    it('pattern covers docs and src roots', () => {
        cr.PATH_PATTERN.lastIndex = 0;
        expect(cr.PATH_PATTERN.test(' `docs/x/y.md` ')).toBe(true);
        cr.PATH_PATTERN.lastIndex = 0;
        expect(cr.PATH_PATTERN.test(' `src/rules/z.md` ')).toBe(true);
        cr.PATH_PATTERN.lastIndex = 0;
    });
});

// ===========================================================================
// Port of test_check_references_memory.py
// ===========================================================================

describe('check_references — YAML-memory branch (port)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = makeTmp();
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function setupRepo(): string {
        fs.mkdirSync(path.join(tmp, 'dist/agent-src/skills/demo-skill'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp, 'dist/agent-src/skills/demo-skill/SKILL.md'),
            '# demo',
            'utf-8',
        );
        fs.mkdirSync(path.join(tmp, 'dist/agent-src/rules'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'dist/agent-src/commands'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'dist/agent-src/guidelines'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'agents/memory/domain-invariants'), { recursive: true });
        return tmp;
    }

    function writeYaml(rel: string, body: string): void {
        const target = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body, 'utf-8');
    }

    it('valid local path passes', () => {
        setupRepo();
        fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'tests/Example.php'), '<?php', 'utf-8');
        writeYaml(
            'agents/memory/domain-invariants/ok.yml',
            '\nversion: 1\nentries:\n  - id: x\n    enforcement:\n      - test: tests/Example.php\n',
        );
        const broken = cr.scan_all(tmp);
        expect(broken.filter((b) => b.ref_type === 'memory-path')).toHaveLength(0);
    });

    it('missing local path fails', () => {
        setupRepo();
        writeYaml(
            'agents/memory/domain-invariants/bad.yml',
            '\nversion: 1\nentries:\n  - id: x\n    enforcement:\n      - test: tests/Missing.php\n',
        );
        const broken = cr.scan_all(tmp);
        const paths = broken.filter((b) => b.ref_type === 'memory-path');
        expect(paths).toHaveLength(1);
        expect(paths[0]!.ref).toBe('tests/Missing.php');
    });

    it('urls and adr skipped', () => {
        setupRepo();
        writeYaml(
            'agents/memory/domain-invariants/urls.yml',
            '\nversion: 1\nentries:\n  - id: x\n    source:\n      - https://example.com/repo/pull/1\n      - adr://0007-whatever\n      - ticket://ABC-1\n',
        );
        const broken = cr.scan_all(tmp);
        expect(broken.filter((b) => b.ref_type === 'memory-path')).toHaveLength(0);
    });

    it('globs skipped', () => {
        setupRepo();
        writeYaml(
            'agents/memory/domain-invariants/globs.yml',
            '\nversion: 1\nentries:\n  - id: x\n    paths:\n      - app/Models/**\n      - app/Policies/Tenant*.php\n',
        );
        const broken = cr.scan_all(tmp);
        expect(broken.filter((b) => b.ref_type === 'memory-path')).toHaveLength(0);
    });

    it('known skill passes', () => {
        setupRepo();
        writeYaml(
            'agents/memory/domain-invariants/skill-ok.yml',
            '\nversion: 1\nentries:\n  - id: x\n    skill: demo-skill\n',
        );
        const broken = cr.scan_all(tmp);
        expect(broken.filter((b) => b.ref_type === 'memory-skill')).toHaveLength(0);
    });

    it('unknown skill warns', () => {
        setupRepo();
        writeYaml(
            'agents/memory/domain-invariants/skill-bad.yml',
            '\nversion: 1\nentries:\n  - id: x\n    skill: nonexistent-skill\n',
        );
        const broken = cr.scan_all(tmp);
        const skillRefs = broken.filter((b) => b.ref_type === 'memory-skill');
        expect(skillRefs).toHaveLength(1);
        expect(skillRefs[0]!.ref).toBe('nonexistent-skill');
        expect(skillRefs[0]!.severity).toBe('warning');
    });

    it('skills list validated', () => {
        setupRepo();
        writeYaml(
            'agents/memory/domain-invariants/skills-list.yml',
            '\nversion: 1\nentries:\n  - id: x\n    skills:\n      - demo-skill\n      - also-missing\n',
        );
        const broken = cr.scan_all(tmp);
        const refs = broken.filter((b) => b.ref_type === 'memory-skill').map((b) => b.ref);
        expect(refs).toEqual(['also-missing']);
    });

    it('empty memory dir is clean', () => {
        setupRepo();
        const broken = cr.scan_all(tmp);
        expect(broken).toEqual([]);
    });
});

// ===========================================================================
// Golden parity on the REAL REPO
// ===========================================================================

