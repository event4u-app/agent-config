// Tests for src/scripts/annotate_discovery.ts (py2ts Phase 8 / Wave 8g).
//
// annotate_discovery is a WRITER with NO injectable SRC/DST/HASH seam (all
// three are derived from the script location). To exercise the CLI without
// leaving tracked-file drift, the CLI block:
//   1. snapshots internal/.condensation-hashes.json,
//   2. creates a throwaway source file under .agent-src.uncondensed/,
//   3. runs the tsx CLI, asserts the written bytes + stdout/stderr + exit
//      code, then restores every touched path.
// Every mutation is snapshot+restored; the live tree is left untouched.
//
// Unit coverage of the pure pieces (render block, idempotency, arg parsing)
// runs unconditionally via the exported TS functions.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    PACK_DEFAULTS,
    ROOT,
    SRC,
    _renderBlock,
    annotate,
} from '../../src/scripts/annotate_discovery.js';
import { runTs } from './_wave8g.js';

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

// --- CLI intent tests (writer; snapshot+restore the live targets) ---------

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

describe('annotate_discovery — CLI (tsx)', () => {
    it('annotates a probe file, updates the hash file, and reports the count', () => {
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

        guard(srcFile);

        fs.writeFileSync(srcFile, original, 'utf-8');
        const r = runTs('annotate_discovery', ['--pack', 'engineering-base', relArg]);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('annotated 1 files with pack=engineering-base\n');
        expect(r.stderr).toBe('');

        const written = fs.readFileSync(srcFile, 'utf-8');
        // Discovery block injected into the frontmatter; body preserved.
        expect(written).toContain('workspaces:\n  - engineering');
        expect(written).toContain('packs:\n  - engineering-base');
        expect(written).toContain('lifecycle: active');
        expect(written.endsWith('---\nbody line\n')).toBe(true);
        expect(written.startsWith('---\nname: probe\ndescription: parity probe\n')).toBe(true);

        // ADR-201: the annotator no longer refreshes a condensation-hash ledger,
        // so nothing outside the source and its dist mirror may be written.
        expect(fs.existsSync(path.join(ROOT, 'internal', '.condensation-hashes.json'))).toBe(false);
    });

    it('skip (missing) path warns on stderr, annotates nothing, exits 0', () => {
        const relArg = path.join('.agent-src.uncondensed', 'rules', '_wave8g_does_not_exist.md');
        const r = runTs('annotate_discovery', ['--pack', 'meta', relArg]);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe(`  skip (missing): ${relArg}\n`);
        expect(r.stdout).toBe('annotated 0 files with pack=meta\n');
        // A skipped path writes nothing at all — the ledger it used to rewrite
        // unconditionally on every run is gone.
        expect(fs.existsSync(path.join(ROOT, 'internal', '.condensation-hashes.json'))).toBe(false);
    });
});
