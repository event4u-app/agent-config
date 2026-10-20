/**
 * The lazy-concern chunk: a concern the dispatch bundle does not inline.
 *
 * Two properties, and the second is the one that makes the first safe:
 *   1. `chat_history.ts` and its closure are OUT of `dist/hooks/dispatch.js`
 *      — asserted against esbuild's own metafile, not against a byte count,
 *      so a re-added static import is named rather than merely measured.
 *   2. A chunk that is absent or mis-digested yields `null`, which sends
 *      `_run_concern` down the spawn path. The concern still runs.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CONCERN_REGISTRY, isInProcessConcern } from '../../../src/scripts/hooks/concern_registry.js';
import {
    LAZY_CONCERNS,
    _resetLazyConcernCache,
    lazyConcernSpecifier,
    loadLazyConcernUncached,
} from '../../../src/scripts/hooks/lazy_concern.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const CHAT_HISTORY = 'src/scripts/chat_history.ts';

describe('lazy concern registration', () => {
    it('chat-history is lazy, not statically registered, and still counts as in-process', () => {
        expect(CONCERN_REGISTRY[CHAT_HISTORY]).toBeUndefined();
        expect(LAZY_CONCERNS[CHAT_HISTORY]).toBeDefined();
        expect(isInProcessConcern(CHAT_HISTORY)).toBe(true);
    });

    it('a script in neither table is not in-process', () => {
        expect(isInProcessConcern('src/scripts/not_a_concern_at_all.ts')).toBe(false);
    });
});

describe('lazyConcernSpecifier', () => {
    const selfUrl = pathToFileURL(path.join(REPO_ROOT, 'dist', 'hooks', 'dispatch.js')).href;

    it('names the sibling chunk when bundled', () => {
        expect(lazyConcernSpecifier(CHAT_HISTORY, selfUrl, true)).toBe(
            path.join(REPO_ROOT, 'dist', 'hooks', 'chat_history.chunk.cjs'),
        );
    });

    it('names the source module when not bundled', () => {
        const fromSource = pathToFileURL(path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'lazy_concern.ts')).href;
        expect(lazyConcernSpecifier(CHAT_HISTORY, fromSource, false)).toBe(path.join(REPO_ROOT, 'src', 'scripts', 'chat_history.ts'));
    });

    it('is null for a script that is not lazy', () => {
        expect(lazyConcernSpecifier('src/scripts/hooks/turn_end_gate_hook.ts', selfUrl, true)).toBeNull();
    });
});

describe('loadLazyConcernUncached', () => {
    it('loads a callable main from the source tree', () => {
        _resetLazyConcernCache();
        // Defaults on purpose: the loader resolves the source module relative
        // to ITS OWN url, which is the path the dispatcher takes from the tree.
        const main = loadLazyConcernUncached(CHAT_HISTORY);
        expect(typeof main).toBe('function');
    });

    it('returns null — never throws — when the chunk is absent', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'lazy-concern-'));
        try {
            const selfUrl = pathToFileURL(path.join(empty, 'dispatch.js')).href;
            expect(loadLazyConcernUncached(CHAT_HISTORY, selfUrl, true)).toBeNull();
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });

    it('loads the built chunk from dist/hooks when one is there', () => {
        const chunk = path.join(REPO_ROOT, 'dist', 'hooks', 'chat_history.chunk.cjs');
        if (!fs.existsSync(chunk)) return; // dist/ is untracked; nothing to assert on a clean checkout
        const selfUrl = pathToFileURL(path.join(REPO_ROOT, 'dist', 'hooks', 'dispatch.js')).href;
        _resetLazyConcernCache();
        expect(typeof loadLazyConcernUncached(CHAT_HISTORY, selfUrl, true)).toBe('function');
    });

    it('returns null when the chunk is present but carries no digest sidecar', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazy-concern-'));
        try {
            fs.writeFileSync(path.join(dir, 'chat_history.chunk.cjs'), 'module.exports = { main: () => 0 };\n');
            const selfUrl = pathToFileURL(path.join(dir, 'dispatch.js')).href;
            expect(loadLazyConcernUncached(CHAT_HISTORY, selfUrl, true)).toBeNull();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('the dispatch bundle', () => {
    it('does not inline chat_history.ts', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-meta-'));
        try {
            const meta = path.join(dir, 'meta.json');
            const r = spawnSync(
                'npx',
                [
                    'esbuild',
                    'src/scripts/hooks/dispatch_entry.ts',
                    '--bundle',
                    '--platform=node',
                    '--format=esm',
                    '--target=node20',
                    '--define:__AGENT_CONFIG_BUNDLE__=true',
                    `--outfile=${path.join(dir, 'probe.js')}`,
                    `--metafile=${meta}`,
                ],
                { cwd: REPO_ROOT, encoding: 'utf-8' },
            );
            expect(r.status, r.stderr).toBe(0);
            const parsed = JSON.parse(fs.readFileSync(meta, 'utf-8')) as { outputs: Record<string, { inputs: Record<string, unknown> }> };
            const inputs = Object.keys(Object.values(parsed.outputs)[0]!.inputs);
            expect(inputs).not.toContain(CHAT_HISTORY);
            // The tag it was extracted for IS in the bundle — the edge that
            // used to drag the whole module in is the one that had to break.
            expect(inputs).toContain('src/scripts/_lib/session_tag.ts');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 120_000);
});
