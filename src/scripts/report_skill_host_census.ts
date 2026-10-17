#!/usr/bin/env tsx
/**
 * Per host and install path: how many authored skills land, what the listing
 * costs, and what the host is modelled to leave out.
 *
 * `road-to-skills-that-arrive-when-called` step 0.1. Phase 4 decides where a
 * skill is materialised on demand, and only where a host drops or lacks one.
 * That decision needs one table, computed and not typed: per host, per install
 * path, the installed count, the listing characters with descriptions and with
 * names only, and the set the host leaves out.
 *
 * WHAT IT IS NOT. A report — the `report_` prefix keeps it out of the gate
 * population, and the exit code carries no verdict. It does not observe a host
 * either: every "omitted" figure is a MODEL over upstream prose, labelled as
 * such, and a host whose omission rule this tree has not read is `unobserved`
 * rather than guessed. Phase 0.2 and 0.3 are the probes; this is the arithmetic
 * they are checked against.
 *
 * THE RULES, stated because they are the whole content:
 *
 *   authored      every `SKILL.md` the canonical walk (`update_counts.iter_skills`)
 *                 yields.
 *   install path  `default` — the installer's scoped projection with no runtime
 *                 packs (`is_pruned_under_scoped`, the predicate the installer
 *                 prunes with); `full` — every authored skill.
 *   host          every tool whose global deploy table writes
 *                 `dist/agent-src/skills`, with the root it writes to.
 *   root_read     whether the host's own skills page names the written root:
 *                 `yes` / `no` where a watched page says so
 *                 (`hooks/host_docs_pages.yaml`), `unobserved` otherwise.
 *   listing chars `name + description` per entry, summed; names-only sums the
 *                 names. Separators and paths are not counted, so both are
 *                 lower bounds on what a host spends.
 *   omitted       claude-code: the descriptions `modelListingBudget` drops at a
 *                 200,000-token window (names are never dropped there). codex:
 *                 the documented budget (8,000 characters when the window is
 *                 unknown) and whether the listing exceeds it; WHICH entries go
 *                 is unobserved, so no set is named. Every other host:
 *                 `unobserved`.
 *
 * Usage:
 *     ./scripts-run src/scripts/report_skill_host_census          # JSON on stdout
 *
 * Deterministic: rows and names sort, no clock, no environment read.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GLOBAL_DEPLOY_SOURCES } from '../install/wizard-plan.js';
import { modelListingBudget } from './_lib/host_listing_model.js';
import {
    compute_active_pack_ids,
    is_pruned_under_scoped,
    load_packs_registry,
} from './_lib/scoped_projection.js';
import { USER_SCOPE_PATHS } from './install.js';
import { iter_skills, REPO_ROOT } from './update_counts.js';
import { parse_frontmatter } from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);

const SKILLS_SRC = 'dist/agent-src/skills';
const CLAUDE_WINDOW_TOKENS = 200_000;
const CODEX_UNKNOWN_WINDOW_BUDGET_CHARS = 8_000;

/** Roots a watched host page names. Anything absent is `unobserved`. */
const DOCUMENTED_USER_ROOTS: Readonly<Record<string, string>> = {
    'claude-code': '~/.claude/skills',
    codex: '~/.agents/skills',
};

export interface SkillEntry {
    name: string;
    descriptionChars: number;
    path: string;
}

export interface CensusRow {
    host: string;
    install_path: 'default' | 'full';
    root: string;
    root_read: 'yes' | 'no' | 'unobserved';
    installed: number;
    not_installed: number;
    authored: number;
    listing_chars_with_descriptions: number;
    listing_chars_names_only: number;
    omitted:
        | { state: 'modelled'; kind: 'description'; budget_chars: number; names: string[] }
        | { state: 'modelled'; kind: 'entry'; budget_chars: number; exceeds_budget: boolean; names: null }
        | { state: 'unobserved' };
}

export interface Census {
    authored: number;
    rows: CensusRow[];
}

export function load_entries(skillPaths: Iterable<string> = iter_skills()): SkillEntry[] {
    const out: SkillEntry[] = [];
    for (const p of skillPaths) {
        const [fm] = parse_frontmatter(fs.readFileSync(p, 'utf-8'));
        const desc = fm === null ? undefined : (fm as Record<string, unknown>)['description'];
        out.push({
            name: path.basename(path.dirname(p)),
            descriptionChars: typeof desc === 'string' ? desc.length : 0,
            path: p,
        });
    }
    return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function skillHosts(): Array<{ host: string; root: string }> {
    const out: Array<{ host: string; root: string }> = [];
    for (const [host, rows] of Object.entries(GLOBAL_DEPLOY_SOURCES)) {
        const row = rows.find(([src]) => src === SKILLS_SRC);
        const anchor = USER_SCOPE_PATHS[host];
        if (row === undefined || anchor === undefined) continue;
        out.push({ host, root: path.posix.join(anchor, row[1]) });
    }
    return out.sort((a, b) => (a.host < b.host ? -1 : a.host > b.host ? 1 : 0));
}

function rootRead(host: string, root: string): CensusRow['root_read'] {
    const documented = DOCUMENTED_USER_ROOTS[host];
    if (documented === undefined) return 'unobserved';
    return documented === root ? 'yes' : 'no';
}

export function build_census(entries: readonly SkillEntry[], package_root: string = REPO_ROOT): Census {
    const active = compute_active_pack_ids(load_packs_registry(package_root), []);
    const scoped = entries.filter((e) => !is_pruned_under_scoped(e.path, active));
    const paths: Array<['default' | 'full', readonly SkillEntry[]]> = [
        ['default', scoped],
        ['full', entries],
    ];
    const rows: CensusRow[] = [];
    for (const { host, root } of skillHosts()) {
        for (const [install_path, set] of paths) {
            const withDesc = set.reduce((n, e) => n + e.name.length + e.descriptionChars, 0);
            const namesOnly = set.reduce((n, e) => n + e.name.length, 0);
            let omitted: CensusRow['omitted'];
            if (host === 'claude-code') {
                const m = modelListingBudget(
                    set.map((e) => ({ name: e.name, descriptionChars: e.descriptionChars })),
                    { contextWindowTokens: CLAUDE_WINDOW_TOKENS },
                );
                omitted = { state: 'modelled', kind: 'description', budget_chars: m.budgetChars, names: [...m.bare].sort() };
            } else if (host === 'codex') {
                omitted = {
                    state: 'modelled',
                    kind: 'entry',
                    budget_chars: CODEX_UNKNOWN_WINDOW_BUDGET_CHARS,
                    exceeds_budget: withDesc > CODEX_UNKNOWN_WINDOW_BUDGET_CHARS,
                    names: null,
                };
            } else {
                omitted = { state: 'unobserved' };
            }
            rows.push({
                host,
                install_path,
                root,
                root_read: rootRead(host, root),
                installed: set.length,
                not_installed: entries.length - set.length,
                authored: entries.length,
                listing_chars_with_descriptions: withDesc,
                listing_chars_names_only: namesOnly,
                omitted,
            });
        }
    }
    return { authored: entries.length, rows };
}

export function main(): number {
    process.stdout.write(`${JSON.stringify(build_census(load_entries()), null, 2)}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
