// Tests for src/scripts/lint_artefact_frontmatter.ts (py2ts Phase 4 / Wave 4b).
//
// Ports tests/test_lint_artefact_frontmatter.py 1:1 — the ADR-013 per-artefact
// contract: required keys, closed-vocabulary enforcement, enum + bool typing,
// missing-frontmatter, and the unassigned-artefacts.yml quarantine rule. The
// Python suite monkeypatches module-level ROOT/SRC/VOCAB_DIR; the TS twin
// exposes `_set_paths` for the same injection. Plus a golden-parity layer
// (python3 vs tsx on the REAL REPO, byte-identical; skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _set_paths, main } from '../../src/scripts/lint_artefact_frontmatter.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


const VALID_FRONTMATTER = `---
name: sample-skill
description: "fixture skill for tests"
workspaces:
  - engineering
packs:
  - engineering-base
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
---

# sample-skill
`;

function makeRepo(tmp: string, skillBody: string = VALID_FRONTMATTER): string {
    const vocab = path.join(tmp, 'config', 'discovery');
    fs.mkdirSync(vocab, { recursive: true });
    fs.writeFileSync(path.join(vocab, 'workspaces.yml'), '- id: engineering\n- id: product\n', 'utf-8');
    fs.writeFileSync(
        path.join(vocab, 'packs.yml'),
        '- id: engineering-base\n- id: product-basic\n',
        'utf-8',
    );
    fs.writeFileSync(path.join(vocab, 'unassigned-artefacts.yml'), '[]\n', 'utf-8');

    const src = path.join(tmp, '.agent-src.uncondensed');
    const skillDir = path.join(src, 'skills', 'sample-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillBody, 'utf-8');
    return tmp;
}

function skillPath(root: string): string {
    return path.join(root, '.agent-src.uncondensed', 'skills', 'sample-skill', 'SKILL.md');
}

function applyPaths(root: string): void {
    _set_paths({
        root,
        src: path.join(root, '.agent-src.uncondensed'),
        vocabDir: path.join(root, 'config', 'discovery'),
    });
}

/** Run main(['--quiet']) capturing stderr; returns [exitCode, stderr]. */
function runMain(): [number, string] {
    let err = '';
    const spyErr = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
        err += String(chunk);
        return true;
    });
    const spyOut = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        const code = main(['--quiet']);
        return [code, err];
    } finally {
        spyErr.mockRestore();
        spyOut.mockRestore();
    }
}

describe('lint_artefact_frontmatter — ported pytest suite', () => {
    let tmp: string;
    let root: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'laf-'));
        root = makeRepo(tmp);
        applyPaths(root);
    });
    afterEach(() => {
        // Restore module paths to the real repo so other suites are unaffected.
        _set_paths({
            root: REPO_ROOT,
            src: path.join(REPO_ROOT, '.agent-src.uncondensed'),
            vocabDir: path.join(REPO_ROOT, 'src', 'config', 'discovery'),
        });
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('valid frontmatter is clean', () => {
        const [code] = runMain();
        expect(code).toBe(0);
    });

    // EXPECTATION CHANGED 2026-08-02 (ADR-013 amendment, § "Strict five-key
    // enforcement narrowed"): this case used to delete `lifecycle` and assert a
    // "missing required key" failure. Only `workspaces` and `packs` are
    // required now — `lifecycle`/`trust`/`install` carry documented schema
    // defaults and `validate_frontmatter`, the gate that actually ran, never
    // required them. The required-key assertion therefore moves to the two keys
    // a default cannot supply; "absent is fine, malformed still fails" is
    // pinned in the dedicated block below.
    it('missing required key `workspaces` fails', () => {
        fs.writeFileSync(
            skillPath(root),
            VALID_FRONTMATTER.replace('workspaces:\n  - engineering\n', ''),
            'utf-8',
        );
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('missing required key `workspaces`');
    });

    it('missing required key `packs` fails', () => {
        fs.writeFileSync(
            skillPath(root),
            VALID_FRONTMATTER.replace('packs:\n  - engineering-base\n', ''),
            'utf-8',
        );
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('missing required key `packs`');
    });

    it('unknown workspace fails', () => {
        fs.writeFileSync(
            skillPath(root),
            VALID_FRONTMATTER.replace('- engineering\n', '- mars-colony\n'),
            'utf-8',
        );
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('workspaces not in workspaces.yml');
    });

    it('unknown pack fails', () => {
        fs.writeFileSync(
            skillPath(root),
            VALID_FRONTMATTER.replace('- engineering-base\n', '- nope-pack\n'),
            'utf-8',
        );
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('packs not in packs.yml');
    });

    it('bad lifecycle enum fails', () => {
        fs.writeFileSync(
            skillPath(root),
            VALID_FRONTMATTER.replace('lifecycle: active', 'lifecycle: yolo'),
            'utf-8',
        );
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('lifecycle `yolo` not in');
    });

    it('bad trust level fails', () => {
        fs.writeFileSync(
            skillPath(root),
            VALID_FRONTMATTER.replace('level: core', 'level: divine'),
            'utf-8',
        );
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('trust.level `divine` not in');
    });

    it('non-bool install.default fails', () => {
        fs.writeFileSync(
            skillPath(root),
            VALID_FRONTMATTER.replace('default: true', 'default: "yes"'),
            'utf-8',
        );
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('install.default must be bool');
    });

    it('missing frontmatter block fails', () => {
        fs.writeFileSync(skillPath(root), '# sample-skill\n\nno frontmatter here.\n', 'utf-8');
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('missing or unparseable frontmatter');
    });

    it('quarantine path skipped when clean', () => {
        const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'laf2-'));
        const root2 = makeRepo(tmp2, '# no frontmatter\n');
        fs.writeFileSync(
            path.join(root2, 'config', 'discovery', 'unassigned-artefacts.yml'),
            '- path: .agent-src.uncondensed/skills/sample-skill/SKILL.md\n' +
                '  reason: scaffold under construction\n',
            'utf-8',
        );
        applyPaths(root2);
        const [code] = runMain();
        expect(code).toBe(0);
        fs.rmSync(tmp2, { recursive: true, force: true });
    });

    it('quarantine collision with frontmatter fails', () => {
        const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'laf3-'));
        const root2 = makeRepo(tmp2);
        fs.writeFileSync(
            path.join(root2, 'config', 'discovery', 'unassigned-artefacts.yml'),
            '- path: .agent-src.uncondensed/skills/sample-skill/SKILL.md\n' +
                '  reason: should not also carry frontmatter\n',
            'utf-8',
        );
        applyPaths(root2);
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('quarantined');
        fs.rmSync(tmp2, { recursive: true, force: true });
    });

    // ADR-013 amendment 2026-08-02. Both directions are pinned deliberately:
    // asserting only "absence passes" would let someone delete the validation
    // entirely and still go green, which is the failure this narrowing is
    // most at risk of being mistaken for.
    describe('schema-defaulted keys — absent is legal, malformed is not', () => {
        for (const [key, removal] of [
            ['lifecycle', 'lifecycle: active\n'],
            ['trust', 'trust:\n  level: core\n  confidence: high\n  human_review_required: false\n'],
            ['install', 'install:\n  default: true\n  removable: true\n'],
        ] as const) {
            it(`omitting \`${key}\` passes — the schema supplies its default`, () => {
                const body = VALID_FRONTMATTER.replace(removal, '');
                expect(body).not.toContain(`${key}:`); // the fixture edit really landed
                fs.writeFileSync(skillPath(root), body, 'utf-8');
                const [code, err] = runMain();
                expect(code, err).toBe(0);
            });
        }

        it('a malformed `lifecycle` that IS present still fails', () => {
            fs.writeFileSync(
                skillPath(root),
                VALID_FRONTMATTER.replace('lifecycle: active', 'lifecycle: yolo'),
                'utf-8',
            );
            const [code, err] = runMain();
            expect(code).toBe(1);
            expect(err).toContain('lifecycle `yolo` not in');
        });

        it('a non-bool `trust.human_review_required` that IS present still fails', () => {
            fs.writeFileSync(
                skillPath(root),
                VALID_FRONTMATTER.replace('human_review_required: false', 'human_review_required: "no"'),
                'utf-8',
            );
            const [code, err] = runMain();
            expect(code).toBe(1);
            expect(err).toContain('trust.human_review_required must be bool');
        });

        it('a malformed `install` block that IS present still fails', () => {
            fs.writeFileSync(
                skillPath(root),
                VALID_FRONTMATTER.replace('install:\n  default: true\n', 'install: not-a-mapping\n'),
                'utf-8',
            );
            const [code, err] = runMain();
            expect(code).toBe(1);
            expect(err).toContain('install must be a mapping');
        });
    });

    // The sub-key half of the same rule (ADR-013 amendment 2026-08-02). A
    // PRESENT block with a MISSING sub-key takes the schema default — this is
    // where the pre-amendment gate contradicted itself, defaulting an absent
    // `trust` object while rejecting a partial one. Across 288 skills `trust`
    // was complete 0 times, so the strict shape had zero adoption.
    describe('schema-defaulted SUB-keys — absent is legal, present-but-invalid is not', () => {
        it('a partial `trust` block (level only) passes', () => {
            const body = VALID_FRONTMATTER.replace(
                'trust:\n  level: core\n  confidence: high\n  human_review_required: false\n',
                'trust:\n  level: core\n',
            );
            expect(body).not.toContain('confidence:');
            expect(body).not.toContain('human_review_required:');
            fs.writeFileSync(skillPath(root), body, 'utf-8');
            const [code, err] = runMain();
            expect(code, err).toBe(0);
        });

        it('a partial `install` block (removable only) passes', () => {
            const body = VALID_FRONTMATTER.replace(
                'install:\n  default: true\n  removable: true\n',
                'install:\n  removable: true\n',
            );
            expect(body).not.toContain('default: true');
            fs.writeFileSync(skillPath(root), body, 'utf-8');
            const [code, err] = runMain();
            expect(code, err).toBe(0);
        });

        // Mutation-critical: a careless "just stop checking sub-keys" narrowing
        // passes every test above and silently kills all three of these.
        it('a present-but-invalid `trust.confidence` still fails', () => {
            fs.writeFileSync(
                skillPath(root),
                VALID_FRONTMATTER.replace('confidence: high', 'confidence: bogus'),
                'utf-8',
            );
            const [code, err] = runMain();
            expect(code).toBe(1);
            expect(err).toContain('trust.confidence `bogus` not in');
        });

        it('a present-but-invalid `trust.level` still fails', () => {
            fs.writeFileSync(
                skillPath(root),
                VALID_FRONTMATTER.replace('level: core', 'level: divine'),
                'utf-8',
            );
            const [code, err] = runMain();
            expect(code).toBe(1);
            expect(err).toContain('trust.level `divine` not in');
        });

        it('a present-but-invalid `install.removable` still fails', () => {
            fs.writeFileSync(
                skillPath(root),
                VALID_FRONTMATTER.replace('removable: true', 'removable: "yes"'),
                'utf-8',
            );
            const [code, err] = runMain();
            expect(code).toBe(1);
            expect(err).toContain('install.removable must be bool');
        });
    });

    // The quarantine-collision predicate keys off an ADR-013 discovery BLOCK,
    // not a bare key name: `trust: <string>` belongs to the knowledge-card and
    // lesson-card template schemas and must not be mistaken for discovery
    // frontmatter. Both directions pinned so the fix cannot rot into "the
    // collision check never fires".
    describe('quarantine collision — discovery block vs. same-named scalar', () => {
        function quarantinedRepo(skillBody: string): string {
            const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'laf-q-'));
            const root2 = makeRepo(tmp2, skillBody);
            // Derived, not hardcoded: the quarantine key is whatever the gate
            // computes as the artefact's repo-relative path, so deriving it
            // from the fixture keeps this correct if the fixture container is
            // ever renamed — and keeps a dead-path literal out of the tree.
            const rel = path.relative(root2, skillPath(root2)).split(path.sep).join('/');
            fs.writeFileSync(
                path.join(root2, 'config', 'discovery', 'unassigned-artefacts.yml'),
                `- path: ${rel}\n  reason: template scaffold\n`,
                'utf-8',
            );
            applyPaths(root2);
            return tmp2;
        }

        it('a quarantined file with a scalar `trust:` is NOT a collision', () => {
            const tmp2 = quarantinedRepo(
                '---\nname: sample-skill\ntype: anti-hallucination\ntrust: durable\n---\n\n# card\n',
            );
            const [code, err] = runMain();
            expect(code, err).toBe(0);
            fs.rmSync(tmp2, { recursive: true, force: true });
        });

        it('a quarantined file with an object `trust:` IS a collision', () => {
            const tmp2 = quarantinedRepo(
                '---\nname: sample-skill\ntrust:\n  level: core\n---\n\n# card\n',
            );
            const [code, err] = runMain();
            expect(code).toBe(1);
            expect(err).toContain('quarantined');
            fs.rmSync(tmp2, { recursive: true, force: true });
        });

        it('a quarantined file carrying `packs:` IS a collision', () => {
            const tmp2 = quarantinedRepo(
                '---\nname: sample-skill\npacks:\n  - engineering-base\n---\n\n# card\n',
            );
            const [code, err] = runMain();
            expect(code).toBe(1);
            expect(err).toContain('quarantined');
            fs.rmSync(tmp2, { recursive: true, force: true });
        });
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

