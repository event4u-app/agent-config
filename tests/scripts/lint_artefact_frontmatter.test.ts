// Tests for src/scripts/lint_artefact_frontmatter.ts (py2ts Phase 4 / Wave 4b).
//
// Ports tests/test_lint_artefact_frontmatter.py 1:1 — the ADR-013 per-artefact
// contract: required keys, closed-vocabulary enforcement, enum + bool typing,
// missing-frontmatter, and the unassigned-artefacts.yml quarantine rule. The
// Python suite monkeypatches module-level ROOT/SRC/VOCAB_DIR; the TS twin
// exposes `_set_paths` for the same injection. Plus a golden-parity layer
// (python3 vs tsx on the REAL REPO, byte-identical; skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _set_paths, main } from '../../src/scripts/lint_artefact_frontmatter.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_artefact_frontmatter.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_artefact_frontmatter.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

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

    it('missing required key fails', () => {
        fs.writeFileSync(skillPath(root), VALID_FRONTMATTER.replace('lifecycle: active\n', ''), 'utf-8');
        const [code, err] = runMain();
        expect(code).toBe(1);
        expect(err).toContain('missing required key `lifecycle`');
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
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_artefact_frontmatter — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --quiet byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
