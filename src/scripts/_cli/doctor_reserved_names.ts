/**
 * The doctor's reserved-name shadow check — `road-to-a-name-no-host-already-owns`
 * step 2.3.
 *
 * The lint keeps the package from SHIPPING a skill under a Claude Code built-in
 * name. It cannot see the user's machine, where the damage actually lands: a
 * `skills/mcp/` deployed by an older version, or one the user wrote, takes `/mcp`
 * away from the host exactly the same way. This check lists those directories
 * under the user and project `.claude/skills/` roots and says whose they are.
 *
 * `ours` means a file under the directory is recorded in the global deploy
 * inventory — the package wrote it, so the next update's reaper removes it once
 * the package no longer ships it. `foreign` means nothing recorded it; the
 * package never deletes it, so the fix is the user's rename.
 *
 * REPORT ONLY. It writes nothing and never refuses: a doctor check returns a
 * verdict, and the reaper — not this check — is what may delete.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { is_claude_builtin_name } from '../_lib/claude_builtin_names.js';
import * as global_deploy_inventory from '../_lib/global_deploy_inventory.js';
import { claudeHome, userHome } from '../_lib/provider_home.js';
import type { WiringCheck } from '../_lib/runtime_wiring_checks.js';

type EnvMap = Record<string, string | undefined>;

export interface ShadowRoot {
    readonly scope: 'user' | 'project';
    readonly dir: string;
}

export interface ShadowRow {
    readonly scope: 'user' | 'project';
    readonly name: string;
    readonly dir: string;
    readonly owner: 'ours' | 'foreign';
    readonly fix: string;
}

function listDirs(dir: string): string[] {
    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory() || e.isSymbolicLink())
            .map((e) => e.name)
            .sort();
    } catch {
        return [];
    }
}

function isRecorded(dir: string, recorded: ReadonlySet<string>): boolean {
    const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
    let real = prefix;
    try {
        real = fs.realpathSync(dir) + path.sep;
    } catch {
        // A dangling directory entry is judged by its lexical path alone.
    }
    for (const file of recorded) {
        if (file.startsWith(prefix) || file.startsWith(real)) return true;
    }
    return false;
}

/** Every reserved-name directory under the given roots, in root order then name order. */
export function scanReservedNameShadows(opts: {
    roots: readonly ShadowRoot[];
    inventory: global_deploy_inventory.Inventory;
    home: string;
}): ShadowRow[] {
    const recorded = global_deploy_inventory.recorded_absolute_files(opts.inventory, opts.home);
    const rows: ShadowRow[] = [];
    for (const root of opts.roots) {
        for (const name of listDirs(root.dir)) {
            if (!is_claude_builtin_name(name)) continue;
            const dir = path.join(root.dir, name);
            const owner = isRecorded(dir, recorded) ? 'ours' : 'foreign';
            const fix =
                owner === 'ours'
                    ? 'run `agent-config upgrade`: the current package no longer ships this name and the deploy reaper removes it'
                    : `rename ${dir} — the package never deletes a skill it did not write`;
            rows.push({ scope: root.scope, name, dir, owner, fix });
        }
    }
    return rows;
}

export function checkReservedNameShadows(opts: { projectRoot: string; env?: EnvMap }): WiringCheck {
    const env = opts.env ?? process.env;
    const rows = scanReservedNameShadows({
        roots: [
            { scope: 'user', dir: path.join(claudeHome(env), 'skills') },
            { scope: 'project', dir: path.join(opts.projectRoot, '.claude', 'skills') },
        ],
        inventory: global_deploy_inventory.load_inventory(global_deploy_inventory.inventory_path(env)),
        home: userHome(env),
    });
    if (rows.length === 0) {
        return {
            id: 'reserved-name-shadows',
            status: 'ok',
            message: 'no skill directory under ~/.claude/skills/ or .claude/skills/ claims a Claude Code built-in name',
            remedy: '',
        };
    }
    const lines = rows.map((r) => `${r.scope} ${r.dir} shadows /${r.name} (${r.owner}) — ${r.fix}`);
    return {
        id: 'reserved-name-shadows',
        status: 'warn',
        message: `${rows.length} skill director${rows.length === 1 ? 'y takes' : 'ies take'} a Claude Code built-in name:\n  ${lines.join('\n  ')}`,
        remedy: rows.some((r) => r.owner === 'ours') ? 'agent-config upgrade' : 'rename the listed directories',
    };
}
