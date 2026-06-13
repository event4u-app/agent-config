// Tests for src/scripts/annotate_discovery.ts (py2ts Phase 8 / Wave 8g).
//
// No Python test suite exists for this module → focused differential.
//
// annotate_discovery is a WRITER with NO injectable SRC/DST/HASH seam (all
// three are derived from the script location). To golden-diff without leaving
// tracked-file drift, the parity block:
//   1. snapshots internal/.condensation-hashes.json,
//   2. creates a throwaway source file under .agent-src.uncondensed/rules/,
//   3. runs python3, captures the written source + hash-file bytes, restores,
//   4. runs tsx, captures, restores,
//   5. asserts byte-identical written bytes + stdout/stderr + exit code.
// Every mutation is snapshot+restored; the live tree is left untouched.
//
// Unit coverage of the pure pieces (render block, idempotency, arg parsing)
// runs unconditionally via the exported TS functions.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    HASH_FILE,
    PACK_DEFAULTS,
    ROOT,
    SRC,
    _renderBlock,
    annotate,
} from '../../src/scripts/annotate_discovery.js';
import { hasPython3, runPy, runTs } from './_wave8g.js';

const py3 = hasPython3();

describe('annotate_discovery — pure pieces', () => {
    it('_renderBlock(meta) matches the locked template', () => {
        const block = _renderBlock('meta');
        // PACK_DEFAULTS.meta = [agent-config-maintainer, core, true, false, active]
        expect(PACK_DEFAULTS.meta).toEqual(['agent-config-maintainer', 'core', true, false, 'active']);
        expect(block).toBe(
            [
                'workspaces:',
                '  - agent-config-maintainer',
                'packs:',
                '  - meta',
                'lifecycle: active',
                'trust:',
                '  level: core',
                '  confidence: high',
                '  human_review_required: false',
                'install:',
                '  default: true',
                '  removable: false',
            ].join('\n'),
        );
    });

    it('_renderBlock(ai-video) is experimental + not-default', () => {
        const block = _renderBlock('ai-video');
        expect(block).toContain('lifecycle: experimental');
        expect(block).toContain('  level: experimental');
        expect(block).toContain('  default: false');
        expect(block).toContain('  removable: true');
    });

    it('annotate is idempotent — a second run is a no-op', () => {
        const dir = fs.mkdtempSync(path.join(ROOT, '.adtest-'));
        try {
            const f = path.join(dir, 'r.md');
            fs.writeFileSync(f, '---\nname: r\ndescription: x\n---\nbody\n', 'utf-8');
            expect(annotate(f, 'meta')).toBe(true);
            const afterFirst = fs.readFileSync(f, 'utf-8');
            expect(afterFirst).toContain('packs:\n  - meta');
            expect(afterFirst).toContain('body\n');
            // second run: keys present → no change.
            expect(annotate(f, 'meta')).toBe(false);
            expect(fs.readFileSync(f, 'utf-8')).toBe(afterFirst);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

// --- golden parity (writer; snapshot+restore the live targets) ------------

const restores: Array<() => void> = [];
afterEach(() => {
    while (restores.length) {
        (restores.pop() as () => void)();
    }
});

/** Snapshot a file (or its absence) and register a restore. */
function guard(p: string): void {
    const existed = fs.existsSync(p);
    const prev = existed ? fs.readFileSync(p) : null;
    restores.push(() => {
        if (prev === null) {
            if (fs.existsSync(p)) {
                fs.rmSync(p, { force: true });
            }
        } else {
            fs.writeFileSync(p, prev);
        }
    });
}

describe.skipIf(!py3)('annotate_discovery — golden parity (python3 vs tsx)', () => {
    it('written source + hash-file bytes byte-identical', () => {
        // Place the probe under a NON-scanned subdir (`_probe8g/`, not
        // rules/skills/commands/contexts) so the parallel
        // prototype_lint_contradictions scan never observes it — the annotate
        // script only requires the file to live somewhere under SRC.
        const probeDir = path.join(SRC, '_probe8g');
        if (!fs.existsSync(probeDir)) {
            fs.mkdirSync(probeDir, { recursive: true });
            restores.push(() => {
                try {
                    fs.rmSync(probeDir, { recursive: true, force: true });
                } catch {
                    /* leave */
                }
            });
        }
        const srcFile = path.join(probeDir, '_wave8g_parity_probe.md');
        const relArg = path.join('.agent-src.uncondensed', '_probe8g', '_wave8g_parity_probe.md');
        const original = '---\nname: probe\ndescription: parity probe\n---\nbody line\n';

        guard(HASH_FILE);
        guard(srcFile);

        const run = (runner: typeof runPy): { stdout: string; stderr: string; status: number | null; src: string; hash: string } => {
            fs.writeFileSync(srcFile, original, 'utf-8');
            const r = runner('annotate_discovery', ['--pack', 'engineering-base', relArg]);
            const written = fs.readFileSync(srcFile, 'utf-8');
            const hash = fs.readFileSync(HASH_FILE, 'utf-8');
            return { stdout: r.stdout, stderr: r.stderr, status: r.status, src: written, hash };
        };

        const py = run(runPy);
        const ts = run(runTs);

        expect(py.status).toBe(0);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.src).toBe(py.src);
        expect(ts.hash).toBe(py.hash);
    });

    it('skip (missing) path byte-identical, hash file still rewritten identically', () => {
        guard(HASH_FILE);
        const relArg = path.join('.agent-src.uncondensed', 'rules', '_wave8g_does_not_exist.md');
        const py = runPy('annotate_discovery', ['--pack', 'meta', relArg]);
        const pyHash = fs.readFileSync(HASH_FILE, 'utf-8');
        const ts = runTs('annotate_discovery', ['--pack', 'meta', relArg]);
        const tsHash = fs.readFileSync(HASH_FILE, 'utf-8');
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(tsHash).toBe(pyHash);
    });
});
