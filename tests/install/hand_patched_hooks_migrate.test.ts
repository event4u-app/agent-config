// The reported VPS workaround hand-edited ten agent-config hook commands in
// `~/.claude/settings.json` to insert a hard-coded global dispatcher path, and
// left eleven foreign hook entries alone. The package fix must replace those ten
// on the next install / refresh / upgrade — removing the hard-coded path — and
// must leave the eleven foreign entries byte-for-byte as they were.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    build_claude_hook_matrix,
    ensure_managed_hooks,
    MANAGED_SIGNATURE,
} from '../../src/scripts/_lib/claude_settings_hooks.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MATRIX = build_claude_hook_matrix(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'));
const HARD_CODED = '/home/agent/.nvm/versions/node/v24.22.0/lib/node_modules/@event4u/agent-config/dist/hooks/dispatch.js';

let tmp: string;
let settingsPath: string;

type Group = { matcher?: string; hooks: Array<{ type: string; command: string }> };

/** Ten managed events, each command hand-patched with the hard-coded dispatcher. */
function handPatched(native: string): Group {
    const original = MATRIX[native] as string;
    return { hooks: [{ type: 'command', command: original.replace('B=""; ', `B=""; [ -f "${HARD_CODED}" ] && B="${HARD_CODED}"; `) }] };
}

/** Eleven foreign entries, some on events we also bind, some on events we do not. */
function foreignGroups(): Record<string, Group[]> {
    const ours = Object.keys(MATRIX);
    const shared = ours.slice(0, 4);
    const out: Record<string, Group[]> = {};
    let n = 0;
    for (const ev of shared) {
        out[ev] = [
            { matcher: 'Bash', hooks: [{ type: 'command', command: `superset hook ${ev} --n ${n++}` }] },
            { hooks: [{ type: 'command', command: `team-audit log ${ev} --n ${n++}` }] },
        ];
    }
    out['Notification'] = [
        { hooks: [{ type: 'command', command: `superset notify --n ${n++}` }] },
        { hooks: [{ type: 'command', command: `say done --n ${n++}` }] },
        { hooks: [{ type: 'command', command: `osascript -e beep --n ${n++}` }] },
    ];
    expect(n).toBe(11);
    return out;
}

function readHooks(): Record<string, Group[]> {
    return (JSON.parse(readFileSync(settingsPath, 'utf8')) as { hooks: Record<string, Group[]> }).hooks;
}

beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'hand-patched-'));
    settingsPath = path.join(tmp, '.claude', 'settings.json');
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    const foreign = foreignGroups();
    const hooks: Record<string, Group[]> = { ...foreign };
    for (const native of Object.keys(MATRIX).slice(0, 10)) {
        hooks[native] = [...(hooks[native] ?? []), handPatched(native)];
    }
    writeFileSync(settingsPath, JSON.stringify({ model: 'opus', hooks }, null, 2));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('an install over a hand-patched settings file', () => {
    it('replaces every hand-patched managed command with the package command', () => {
        expect(readFileSync(settingsPath, 'utf8')).toContain(HARD_CODED);
        ensure_managed_hooks(settingsPath, MATRIX);
        const after = readFileSync(settingsPath, 'utf8');
        expect(after).not.toContain(HARD_CODED);
        for (const [native, command] of Object.entries(MATRIX)) {
            const managed = (readHooks()[native] ?? []).flatMap((g) => g.hooks).filter((h) => h.command.includes(MANAGED_SIGNATURE));
            expect(managed.map((h) => h.command), native).toEqual([command]);
        }
    });

    it('leaves all eleven foreign entries exactly as they were', () => {
        const before = foreignGroups();
        ensure_managed_hooks(settingsPath, MATRIX);
        const after = readHooks();
        let kept = 0;
        for (const [native, groups] of Object.entries(before)) {
            const foreignAfter = (after[native] ?? []).filter((g) => !g.hooks.some((h) => h.command.includes(MANAGED_SIGNATURE)));
            expect(foreignAfter, native).toEqual(groups);
            kept += groups.length;
        }
        expect(kept).toBe(11);
    });

    it('keeps unrelated settings keys', () => {
        ensure_managed_hooks(settingsPath, MATRIX);
        expect((JSON.parse(readFileSync(settingsPath, 'utf8')) as { model: string }).model).toBe('opus');
    });

    it('is idempotent: a second run changes nothing', () => {
        ensure_managed_hooks(settingsPath, MATRIX);
        const once = readFileSync(settingsPath, 'utf8');
        expect(ensure_managed_hooks(settingsPath, MATRIX).changed).toBe(false);
        expect(readFileSync(settingsPath, 'utf8')).toBe(once);
    });
});
