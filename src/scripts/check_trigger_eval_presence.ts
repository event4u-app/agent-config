#!/usr/bin/env tsx
/**
 * Trigger-eval PRESENCE ratchet (road-to-composition-ratchet Phase 1).
 *
 * `check_trigger_evals.ts` validates freshness + structure of triggers.json
 * files that EXIST; it cannot flag a new skill that ships without one, even
 * though the drafting protocol mandates the stub. This gate closes that gap
 * with a shrink-only grandfather allowlist
 * (`src/scripts/trigger_eval_grandfather.json`, frozen 2026-07-08 at 221
 * entries):
 *
 *   1. Every skill under `src/skills/` must either carry
 *      `evals/triggers.json` or appear in the allowlist.
 *   2. An allowlist entry whose skill directory no longer exists is stale
 *      and must be removed.
 *   3. An allowlist entry whose skill HAS a triggers.json must be removed —
 *      the list may only shrink (ratchet), never regrow.
 *
 * Structure + freshness of existing files stay owned by
 * `check_trigger_evals.ts`; this gate checks presence only.
 *
 * Exit codes: 0 ok · 1 violation(s) · 2 usage / unreadable allowlist.
 * `--quiet` suppresses the ✅ summary (errors always print to stderr).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'src', 'skills');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'src', 'scripts', 'trigger_eval_grandfather.json');

interface Allowlist {
    skills: string[];
}

function load_allowlist(p: string): Allowlist | null {
    try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
        if (
            typeof raw !== 'object' ||
            raw === null ||
            !Array.isArray((raw as { skills?: unknown }).skills) ||
            !(raw as { skills: unknown[] }).skills.every((s) => typeof s === 'string')
        ) {
            return null;
        }
        return { skills: (raw as { skills: string[] }).skills };
    } catch {
        return null;
    }
}

function list_skill_dirs(root: string): string[] {
    return fs
        .readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
}

function has_triggers(skill: string): boolean {
    return fs.existsSync(path.join(SKILLS_DIR, skill, 'evals', 'triggers.json'));
}

interface Findings {
    errors: string[];
    covered: number;
    total: number;
}

function check(skills: string[], allowlisted: string[]): Findings {
    const allow = new Set(allowlisted);
    const skillSet = new Set(skills);
    const errors: string[] = [];
    let covered = 0;

    for (const skill of skills) {
        if (has_triggers(skill)) {
            covered += 1;
            if (allow.has(skill)) {
                errors.push(
                    `${skill}: has evals/triggers.json but is still in the grandfather allowlist — remove the entry (shrink-only ratchet)`,
                );
            }
        } else if (!allow.has(skill)) {
            errors.push(
                `${skill}: missing evals/triggers.json and not grandfathered — new/changed skills must ship a trigger-eval set (see artifact-drafting-protocol Phase C)`,
            );
        }
    }

    for (const entry of allowlisted) {
        if (!skillSet.has(entry)) {
            errors.push(
                `allowlist entry "${entry}" has no matching skill directory — remove the stale entry`,
            );
        }
    }

    return { errors, covered, total: skills.length };
}

function parse_args(argv: string[]): { quiet: boolean } | null {
    let quiet = false;
    for (const a of argv) {
        if (a === '--quiet' || a === '-q') {
            quiet = true;
        } else {
            return null;
        }
    }
    return { quiet };
}

function main(): number {
    const args = parse_args(process.argv.slice(2));
    if (args === null) {
        process.stderr.write('usage: check_trigger_eval_presence [--quiet]\n');
        return 2;
    }

    const allowlist = load_allowlist(ALLOWLIST_PATH);
    if (allowlist === null) {
        process.stderr.write(
            `❌ check-trigger-eval-presence: unreadable or malformed allowlist at ${path.relative(REPO_ROOT, ALLOWLIST_PATH)}\n`,
        );
        return 2;
    }

    // The ratchet only bites per skill directory found: an empty (or moved)
    // skills root makes every rule in `check` iterate nothing, and the ✅ line
    // reads "0/0 skills carry evals/triggers.json" — a passing presence gate
    // over no skills at all.
    const skills = list_skill_dirs(SKILLS_DIR);
    try {
        assertScanned({
            gate: 'check_trigger_eval_presence',
            scanned: skills.length,
            units: 'skill director(ies)',
            roots: ['src/skills'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌ ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const { errors, covered, total } = check(skills, allowlist.skills);

    if (errors.length) {
        process.stderr.write('❌ check-trigger-eval-presence: presence-ratchet violation(s):\n');
        for (const e of errors) {
            process.stderr.write(`   - ${e}\n`);
        }
        return 1;
    }

    if (!args.quiet) {
        process.stdout.write(
            `✅ check-trigger-eval-presence: ${covered}/${total} skills carry evals/triggers.json (${allowlist.skills.length} grandfathered, shrink-only)\n`,
        );
    }
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ALLOWLIST_PATH, check, load_allowlist, parse_args, main };
