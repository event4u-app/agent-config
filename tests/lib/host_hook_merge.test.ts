/**
 * Coexistence fixture for `src/scripts/_lib/host_hook_merge.ts`
 * (road-to-a-tree-that-keeps-its-neighbours Phase 1.1).
 *
 * The lifecycle assertion is the point: a foreign hook entry written by
 * another agent package must come out of install, upgrade and uninstall
 * byte-identical, and exactly one entry of ours must exist after each
 * install — never a stale duplicate from a previous version's command string.
 */

import { describe, expect, it } from 'vitest';

import {
    HOOK_SIGNATURES,
    entryCommands,
    isManagedEntry,
    mergeEventEntries,
    mergeHookEvents,
    mergeHostConfig,
} from '../../src/scripts/_lib/host_hook_merge.js';
import { deepMerge } from '../../src/scripts/_lib/json_merge.js';
import { build_merge_entries, subtract_pointers } from '../../src/scripts/_lib/json_pointers.js';

/** A neighbour package's cursor entry — the thing that must survive. */
const FOREIGN_CURSOR = { command: 'npx other-agent-pack hook --event beforeShellExecution' };

/** What this package writes for cursor at the project level. */
function ourCursorEntry(): Record<string, unknown> {
    return {
        command:
            '[ -x ./agent-config ] || exit 0; ./agent-config dispatch:hook ' +
            '--platform cursor --event pre_tool_use --native-event beforeShellExecution',
    };
}

const CURSOR_LABEL = '.cursor/hooks.json';
const CURSOR_SIG = HOOK_SIGNATURES[CURSOR_LABEL];

describe('entryCommands — every shape this package reads', () => {
    it('reads the flat {command} shape (cursor, windsurf)', () => {
        expect(entryCommands({ command: 'a' })).toStrictEqual(['a']);
    });

    it('reads the nested {hooks:[{command}]} group shape (augment)', () => {
        expect(entryCommands({ hooks: [{ type: 'command', command: 'b' }] })).toStrictEqual(['b']);
    });

    it('reads the {matcher, hooks:[…]} group shape (gemini, claude)', () => {
        expect(
            entryCommands({ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'c' }] }),
        ).toStrictEqual(['c']);
    });

    it('returns nothing for a shape it cannot read, so the entry is foreign', () => {
        expect(entryCommands({ run: 'something-else' })).toStrictEqual([]);
        expect(isManagedEntry({ run: 'something-else' }, CURSOR_SIG)).toBe(false);
    });
});

describe('mergeEventEntries', () => {
    it('keeps a foreign entry byte-identical and appends ours', () => {
        const merged = mergeEventEntries([FOREIGN_CURSOR], [ourCursorEntry()], CURSOR_SIG);
        expect(merged).toHaveLength(2);
        expect(merged[0]).toStrictEqual(FOREIGN_CURSOR);
    });

    it('replaces our own entry rather than duplicating it on re-install', () => {
        const first = mergeEventEntries([FOREIGN_CURSOR], [ourCursorEntry()], CURSOR_SIG);
        const second = mergeEventEntries(first, [ourCursorEntry()], CURSOR_SIG);
        expect(second).toHaveLength(2);
        expect(second.filter((e) => isManagedEntry(e, CURSOR_SIG))).toHaveLength(1);
    });

    it('replaces an OLDER command string of ours — no stale duplicate after a migration', () => {
        const old = {
            command: './agent-config dispatch:hook --platform cursor --event pre_tool_use',
        };
        const merged = mergeEventEntries([FOREIGN_CURSOR, old], [ourCursorEntry()], CURSOR_SIG);
        expect(merged.filter((e) => isManagedEntry(e, CURSOR_SIG))).toHaveLength(1);
        expect(merged[0]).toStrictEqual(FOREIGN_CURSOR);
    });

    it('keeps the foreign entry first — order is preserved, not rebuilt', () => {
        const other = { command: 'npx third-pack hook' };
        const merged = mergeEventEntries([FOREIGN_CURSOR, other], [ourCursorEntry()], CURSOR_SIG);
        expect(merged.slice(0, 2)).toStrictEqual([FOREIGN_CURSOR, other]);
    });
});

describe('mergeHookEvents', () => {
    it('leaves an event the patch never mentions completely alone', () => {
        const existing = { afterFileEdit: [FOREIGN_CURSOR] };
        const merged = mergeHookEvents(existing, { beforeShellExecution: [ourCursorEntry()] }, CURSOR_SIG);
        expect(merged['afterFileEdit']).toStrictEqual([FOREIGN_CURSOR]);
    });

    it('treats an absent hooks object as nothing to preserve', () => {
        const merged = mergeHookEvents(undefined, { x: [ourCursorEntry()] }, CURSOR_SIG);
        expect(merged['x']).toHaveLength(1);
    });
});

describe('mergeHostConfig — non-hook keys keep deepMerge semantics', () => {
    it('replaces a non-hook array wholesale, as before', () => {
        const merged = mergeHostConfig(
            { enabledPlugins: ['a'], hooks: { e: [FOREIGN_CURSOR] } },
            { enabledPlugins: ['b'], hooks: { e: [ourCursorEntry()] } },
            CURSOR_SIG,
            deepMerge,
        );
        expect(merged['enabledPlugins']).toStrictEqual(['b']);
        expect((merged['hooks'] as Record<string, unknown[]>)['e']).toHaveLength(2);
    });

    it('is a plain deepMerge when the writer has no signature', () => {
        const merged = mergeHostConfig(
            { hooks: { e: [FOREIGN_CURSOR] } },
            { hooks: { e: [ourCursorEntry()] } },
            '',
            deepMerge,
        );
        expect((merged['hooks'] as Record<string, unknown[]>)['e']).toHaveLength(1);
    });
});

describe('install -> upgrade -> uninstall leaves the neighbour byte-identical', () => {
    it('round-trips a .cursor/hooks.json carrying one foreign entry', () => {
        const foreignBefore = JSON.stringify(FOREIGN_CURSOR);
        let file: Record<string, unknown> = {
            version: 1,
            hooks: { beforeShellExecution: [{ ...FOREIGN_CURSOR }] },
        };

        const patch = (): Record<string, unknown> => ({
            version: 1,
            hooks: { beforeShellExecution: [ourCursorEntry()] },
        });

        // install
        file = mergeHostConfig(file, patch(), CURSOR_SIG, deepMerge);
        // upgrade — the same writer runs again
        file = mergeHostConfig(file, patch(), CURSOR_SIG, deepMerge);

        const afterInstall = (file['hooks'] as Record<string, unknown[]>)['beforeShellExecution'];
        expect(afterInstall).toHaveLength(2);
        expect(afterInstall.filter((e) => isManagedEntry(e, CURSOR_SIG))).toHaveLength(1);
        expect(JSON.stringify(afterInstall[0])).toBe(foreignBefore);

        // uninstall, through the real manifest path
        const entries = build_merge_entries(CURSOR_LABEL, patch());
        const [after, warnings] = subtract_pointers(file, entries);
        const hooks = after['hooks'] as Record<string, unknown[]> | undefined;
        expect(hooks?.['beforeShellExecution']).toStrictEqual([JSON.parse(foreignBefore)]);
        expect(warnings.filter((w) => w.reason === 'drift')).toStrictEqual([]);
    });

    it('removes the event key entirely when nothing foreign shares it', () => {
        const patch = { version: 1, hooks: { beforeShellExecution: [ourCursorEntry()] } };
        const file = mergeHostConfig({}, patch, CURSOR_SIG, deepMerge);
        const [after] = subtract_pointers(file, build_merge_entries(CURSOR_LABEL, patch));
        expect(after['hooks']).toBeUndefined();
    });
});

describe('HOOK_SIGNATURES', () => {
    it('covers every writer that writes a hooks array', () => {
        expect(Object.keys(HOOK_SIGNATURES).sort()).toStrictEqual([
            '.cursor/hooks.json',
            '.gemini/settings.json',
            '.windsurf/hooks.json',
            '~/.augment/settings.json',
            '~/.codeium/windsurf/hooks.json',
            '~/.cursor/hooks.json',
            '~/.gemini/settings.json',
        ]);
    });

    it('carries no empty signature — an empty one would match nothing and own nothing', () => {
        for (const [label, sig] of Object.entries(HOOK_SIGNATURES)) {
            expect(sig, label).not.toBe('');
        }
    });
});
