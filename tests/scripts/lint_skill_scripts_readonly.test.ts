/**
 * Fixture tests for `src/scripts/lint_skill_scripts_readonly.ts`
 * (ecosystem-harvest skill-quality-gates, Phase 3).
 *
 * Must-fail: a skill script that writes a file with no write-gating flag.
 * Must-pass: a gated writer (mutation behind --output), a read-only script,
 * and a shell script that only reads. Plus a CLI-contract assertion that the
 * real repo is clean (all script-bearing skills gated or allowlisted).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GATE_RE, hasWritePrimitive } from '../../src/scripts/lint_skill_scripts_readonly.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPT = path.join(REPO, 'src', 'scripts', 'lint_skill_scripts_readonly.ts');

describe('write-primitive detection (language-scoped)', () => {
    it('detects a JS/TS file write', () => {
        expect(hasWritePrimitive('fs.writeFileSync(p, x);', '.ts')).toBe(true);
    });
    it('does NOT trip on an arrow returning a string literal (=> "…")', () => {
        expect(hasWritePrimitive('const f = () => "hello"; if (a >  "b") {}', '.ts')).toBe(false);
    });
    it('detects a python write', () => {
        expect(hasWritePrimitive("open(p, 'w').write(x)", '.py')).toBe(true);
    });
    it('detects a shell redirect only in .sh', () => {
        expect(hasWritePrimitive('echo hi > out.txt', '.sh')).toBe(true);
        expect(hasWritePrimitive('const x = a > b ? 1 : 2', '.ts')).toBe(false);
    });
});

describe('gating flag recognition', () => {
    it('recognizes --output as a write gate', () => {
        expect(GATE_RE.test('if (parsed.output) fs.writeFileSync(...)')).toBe(true);
    });
    it('read-only script has no gate flag', () => {
        expect(GATE_RE.test('const x = 1;')).toBe(false);
    });
});

describe('CLI contract — must-fail fixture tree + real repo', () => {
    let work: string;
    beforeEach(() => {
        work = fs.mkdtempSync(path.join(os.tmpdir(), 'sqg-ro-'));
    });
    afterEach(() => fs.rmSync(work, { recursive: true, force: true }));

    it('flags an ungated writer (exit 1)', () => {
        const d = path.join(work, 'bad-skill', 'scripts');
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'gen.ts'), 'import fs from "node:fs";\nfs.writeFileSync("out.txt", "x");\n');
        const r = spawnSync(TSX, [SCRIPT, '--root', work], { cwd: REPO, encoding: 'utf8' });
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('gen.ts');
    });

    it('passes a gated writer (exit 0)', () => {
        const d = path.join(work, 'ok-skill', 'scripts');
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'gen.ts'), 'import fs from "node:fs";\nif (parsed.output) fs.writeFileSync(parsed.output, "x"); // --output gate\n');
        const r = spawnSync(TSX, [SCRIPT, '--root', work], { cwd: REPO, encoding: 'utf8' });
        expect(r.status).toBe(0);
    });

    it('the real repo is clean (all script-bearing skills gated or allowlisted)', () => {
        const r = spawnSync(TSX, [SCRIPT, '--quiet'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        expect(r.status).toBe(0);
    });

    it('bundles-not-double-counted: a committed bundle proven to be its source build is read once', () => {
        // The real tree: every build:skill-scripts entry point ships a .mjs. The
        // lint rebuilds them and skips only the ones that equal the build, so the
        // count is the sources alone — the bundles are not read a second time.
        const r = spawnSync(TSX, [SCRIPT], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        expect(r.status).toBe(0);
        const scripts = /(\d+) skill script\(s\)/.exec(r.stdout);
        const mjs = fs
            .readdirSync(path.join(REPO, 'src', 'skills'), { recursive: true, encoding: 'utf8' })
            .filter((f) => /\/scripts\/.*\.mjs$/.test(f.split(path.sep).join('/')));
        const all = fs
            .readdirSync(path.join(REPO, 'src', 'skills'), { recursive: true, encoding: 'utf8' })
            .filter((f) => /\/scripts\/.*\.(ts|js|mjs|cjs|py|sh)$/.test(f.split(path.sep).join('/')));
        expect(mjs.length).toBeGreaterThan(0);
        expect(Number(scripts?.[1])).toBe(all.length - mjs.length);
    });

    it('a diverged bundle beside its source is scanned as itself, not skipped', () => {
        // The .mjs is what ships. A sibling .ts proves nothing about its bytes: a
        // stale, hand-edited or tampered bundle with an ungated write must fail
        // even when its source is a clean, gated writer (finding 23f0cf03e558).
        const d = path.join(work, 'bundled-skill', 'scripts');
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(
            path.join(d, 'gen.ts'),
            'import fs from "node:fs";\nif (parsed.output) fs.writeFileSync(parsed.output, "x"); // --output gate\n',
        );
        fs.writeFileSync(path.join(d, 'gen.mjs'), 'import fs from "node:fs";\nfs.writeFileSync("out.txt", "x");\n');
        const diverged = spawnSync(TSX, [SCRIPT, '--root', work], { cwd: REPO, encoding: 'utf8' });
        expect(diverged.status).toBe(1);
        expect(diverged.stderr).toContain('gen.mjs');
        expect(diverged.stderr).toContain('1 ungated write');

        // A .mjs with no .ts beside it is somebody's hand-written script and
        // is read the same way.
        fs.writeFileSync(path.join(d, 'standalone.mjs'), 'import fs from "node:fs";\nfs.writeFileSync("out.txt", "x");\n');
        const standalone = spawnSync(TSX, [SCRIPT, '--root', work], { cwd: REPO, encoding: 'utf8' });
        expect(standalone.stderr).toContain('2 ungated write');
        expect(standalone.stderr).toContain('standalone.mjs');
    });
});
