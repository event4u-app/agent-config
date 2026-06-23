
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as ma from '../../src/scripts/move_artefact.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'move_artefact.ts');
const NODE_MODULES = path.join(REPO_ROOT, 'node_modules');
const TSX_BIN = path.join(
    NODE_MODULES,
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

// --- _rewrite_packs (no git) ------------------------------------------------

describe('move_artefact — _rewrite_packs', () => {
    function tmpMd(content: string): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-md-'));
        const p = path.join(dir, 'SKILL.md');
        fs.writeFileSync(p, content, 'utf-8');
        return p;
    }

    it('sets packs to [target] for a non-core move', () => {
        const p = tmpMd('---\nname: demo\ndescription: A demo skill\n---\n\nBody.\n');
        const changed = ma._rewrite_packs(p, 'laravel', false);
        expect(changed).toBe(true);
        const text = fs.readFileSync(p, 'utf-8');
        expect(text).toContain('packs:\n- laravel\n');
        expect(text.endsWith('\nBody.\n')).toBe(true);
    });

    it('removes packs for a core move', () => {
        const p = tmpMd('---\nname: demo\npacks:\n- laravel\n---\n\nBody.\n');
        const changed = ma._rewrite_packs(p, 'core', false);
        expect(changed).toBe(true);
        const text = fs.readFileSync(p, 'utf-8');
        expect(text).not.toContain('packs:');
        expect(text).toContain('name: demo');
    });

    it('returns false when already at target', () => {
        const p = tmpMd('---\nname: demo\npacks:\n- laravel\n---\nBody.\n');
        expect(ma._rewrite_packs(p, 'laravel', false)).toBe(false);
    });

    it('dry-run does not write', () => {
        const p = tmpMd('---\nname: demo\n---\nBody.\n');
        const before = fs.readFileSync(p, 'utf-8');
        // capture stdout
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout.write as unknown) = (): boolean => true;
        try {
            expect(ma._rewrite_packs(p, 'laravel', true)).toBe(true);
        } finally {
            (process.stdout.write as unknown) = orig;
        }
        expect(fs.readFileSync(p, 'utf-8')).toBe(before);
    });
});

// --- _move_root -------------------------------------------------------------

describe('move_artefact — _move_root', () => {
    it('skill → parent dir; rule/command → file', () => {
        expect(ma._move_root('/a/b/skills/demo/SKILL.md', 'skill')).toBe(
            path.join('/a/b/skills/demo'),
        );
        expect(ma._move_root('/a/b/rules/demo.md', 'rule')).toBe('/a/b/rules/demo.md');
        expect(ma._move_root('/a/b/commands/demo.md', 'command')).toBe('/a/b/commands/demo.md');
    });
});

/** Snapshot the tracked + untracked tree (path → content), excluding .git + node_modules. */
function snapshotTree(root: string): Map<string, string> {
    const out = new Map<string, string>();
    const walk = (dir: string): void => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            if (ent.name === '.git' || ent.name === 'node_modules') {
                continue;
            }
            const full = path.join(dir, ent.name);
            if (ent.isSymbolicLink()) {
                continue;
            }
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isFile()) {
                const rel = path.relative(root, full).split(path.sep).join('/');
                // skip the copied scripts (identical by construction)
                if (rel === 'src/scripts/move_artefact.py' || rel === 'src/scripts/move_artefact.ts') {
                    continue;
                }
                out.set(rel, fs.readFileSync(full, 'utf-8'));
            }
        }
    };
    walk(root);
    return out;
}
