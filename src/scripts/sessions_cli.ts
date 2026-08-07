#!/usr/bin/env node
/**
 * `agent-config sessions:list` / `sessions:claim` — the shell surface of the
 * shared session register.
 *
 * The register is written by a hook (`session_register_hook.ts`) and read by two
 * very different consumers: another hook, which imports the library directly,
 * and a **command markdown** — `/roadmap:next` — which is prose the model
 * follows and can only reach a script through a shell call. This file is that
 * call.
 *
 * Giving the command a real verb instead of asking the model to read and parse
 * JSON files matters for honesty, not convenience: the *screen* stays
 * model-carried either way (nothing forces the model to run it), but what the
 * screen does once invoked becomes deterministic and testable rather than a
 * re-derivation each time.
 *
 * ## Subcommands
 *
 * - `list [--json]` — live sessions on this repo. Human table by default; `--json`
 *   emits the raw records for a scripted screen. Exits 0 with an empty result
 *   when there is no register — its absence is the normal pre-first-session
 *   state, never an error.
 * - `claim <slug>` — record that THIS worktree's session has taken a roadmap.
 *   Writes the bridge file the next heartbeat lifts into the register.
 * - `claim --release` — clear the claim.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { write_atomic } from './_lib/fs_atomic.js';
import {
    iso_now,
    read_live_records,
    register_dir,
    ttl_is_measured,
    ttl_seconds_for,
} from './_lib/session_register.js';
import { ROADMAP_CLAIM_REL } from './session_register_hook.js';

function usage(): number {
    process.stderr.write(
        [
            'usage:',
            '  agent-config sessions:list [--json]      live sessions on this repository',
            '  agent-config sessions:claim <slug>       claim a roadmap for this session',
            '  agent-config sessions:claim --release    drop this session\'s roadmap claim',
            '',
        ].join('\n'),
    );
    return 2;
}

function cmd_list(argv: string[], root: string): number {
    const as_json = argv.includes('--json');
    const dir = register_dir(root);
    const records = dir === null ? [] : read_live_records(dir, { prune: true });

    if (as_json) {
        process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
        return 0;
    }

    if (records.length === 0) {
        process.stdout.write('No live sessions registered on this repository.\n');
        return 0;
    }

    const now = Date.now();
    process.stdout.write(`${records.length} live session(s) on this repository:\n\n`);
    for (const r of records) {
        const age_min = Math.max(0, Math.round((now - Date.parse(r.last_seen)) / 60000));
        const ttl_h = Math.round(ttl_seconds_for(r.platform) / 3600);
        const ttl_note = ttl_is_measured(r.platform) ? `${ttl_h}h` : `${ttl_h}h (unmeasured host)`;
        process.stdout.write(
            [
                `  ${r.session_id}`,
                `    host:     ${r.platform}  ·  TTL ${ttl_note}`,
                `    branch:   ${r.branch ?? '(detached)'}`,
                `    roadmap:  ${r.roadmap_slug ?? '(none claimed)'}`,
                `    worktree: ${r.worktree}`,
                `    seen:     ${age_min} min ago`,
                '',
            ].join('\n'),
        );
    }
    process.stdout.write(
        'Advisory only — this register is not a lock, and an idle session\n' +
            'disappears from it after its TTL although its user may return.\n',
    );
    return 0;
}

function cmd_claim(argv: string[], root: string): number {
    const target = path.join(root, ROADMAP_CLAIM_REL);
    if (argv.includes('--release')) {
        try {
            fs.unlinkSync(target);
        } catch {
            /* nothing to release */
        }
        process.stdout.write('Roadmap claim released.\n');
        return 0;
    }
    const slug = argv.find((a) => !a.startsWith('-'));
    if (slug === undefined || slug.trim() === '') {
        return usage();
    }
    try {
        write_atomic(target, `${JSON.stringify({ slug: slug.trim(), written_at: iso_now() }, null, 2)}\n`);
    } catch (exc) {
        process.stderr.write(`sessions:claim: could not write the claim — ${String(exc)}\n`);
        return 1; // the claim is the whole point of this verb; a silent no-op would lie
    }
    process.stdout.write(
        `Claimed "${slug.trim()}" for this session. It becomes visible to other\n` +
            'sessions on the next turn, when the heartbeat lifts it into the register.\n',
    );
    return 0;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const root = process.cwd();
    const sub = argv[0] ?? '';
    const rest = argv.slice(1);
    if (sub === 'list') return cmd_list(rest, root);
    if (sub === 'claim') return cmd_claim(rest, root);
    return usage();
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main());
}
