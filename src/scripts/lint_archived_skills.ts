#!/usr/bin/env tsx
/**
 * Lint archive notes under agents/evidence/archived-skills/.
 *
 * Ported from the retired Python `src/scripts/lint_archived_skills.py` (ADR-200, Phase 4
 * / Wave 4b). The CLI contract is pinned — `--quiet` flag, exit
 * codes (0 contract holds, 1 violations), stdout/stderr split,
 * byte-identical finding messages, same scan trees and order, same
 * frontmatter parser, same `artefact_roots()` skill-root discovery.
 *
 * Enforces the contract from
 * src/agent-src/templates/skill-archive-note.md:
 *
 *   1. Every <slug>.md under agents/evidence/archived-skills/ has the six
 *      required frontmatter fields with valid values.
 *   2. `reason` is one of {unused, merged, superseded, deprecated}.
 *   3. When `reason ∈ {merged, superseded}` the `replacement` slug exists
 *      under a live skills root.
 *   4. No archived slug still has a live SKILL.md (no zombies).
 *   5. No live SKILL.md cites an archived slug as a router target in its
 *      frontmatter `replaced_by:` field.
 *   6. A slug that had a `SKILL.md` at the base ref and has none in the
 *      working tree carries an archive note. See {@link removed_without_note}.
 *
 * Exit codes:
 *   0  contract holds
 *   1  one or more violations
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots } from './_lib/agent_src.js';
import { resolveBaseRef } from './_lib/ratchet_base_ref.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

const QUIET = process.argv.slice(2).includes('--quiet');

// parents[2] — three dirs up from src/scripts/lint_archived_skills.ts.
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const ARCHIVE_DIR = path.join(REPO, 'agents', 'evidence', 'archived-skills');

// Live skill directories live under every artefact root.
const ALL_SKILLS_DIRS = artefact_roots().map((root) => path.join(root, 'skills'));
const SKILLS_DIRS = ALL_SKILLS_DIRS.filter((d) => _isDir(d));

const REQUIRED_FIELDS = [
    'slug',
    'archived_on',
    'last_seen_count',
    'reason',
    'replacement',
    'last_known_callers',
] as const;
const VALID_REASONS = new Set(['unused', 'merged', 'superseded', 'deprecated']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parse_frontmatter(text: string): Record<string, string> | null {
    if (!text.startsWith('---\n')) {
        return null;
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return null;
    }
    const fields: Record<string, string> = {};
    for (const line of text.slice(4, end).split('\n')) {
        if (!line.includes(':') || line.startsWith(' ') || line.startsWith('-')) {
            continue;
        }
        const idx = line.indexOf(':');
        const k = line.slice(0, idx);
        const v = line.slice(idx + 1);
        fields[k.trim()] = _stripQuotes(v.trim());
    }
    return fields;
}

/** Mirror Python `.strip('"').strip("'")` — outer-only quote removal. */
function _stripQuotes(s: string): string {
    let out = _strip(s, '"');
    out = _strip(out, "'");
    return out;
}

/** Mirror Python str.strip(chars) — strip leading/trailing chars in set. */
function _strip(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) {
        start += 1;
    }
    while (end > start && chars.includes(s[end - 1] as string)) {
        end -= 1;
    }
    return s.slice(start, end);
}

function archived_slugs(): string[] {
    if (!_isDir(ARCHIVE_DIR)) {
        return [];
    }
    return fs
        .readdirSync(ARCHIVE_DIR)
        .filter((n) => n.endsWith('.md') && n !== 'README.md')
        .map((n) => path.join(ARCHIVE_DIR, n))
        .sort();
}

function live_skill_slugs(): Set<string> {
    const slugs = new Set<string>();
    for (const skillsDir of SKILLS_DIRS) {
        for (const name of _iterdir(skillsDir)) {
            const p = path.join(skillsDir, name);
            if (_isDir(p) && _isFile(path.join(p, 'SKILL.md'))) {
                slugs.add(name);
            }
        }
    }
    return slugs;
}

function main(): number {
    if (!_exists(ARCHIVE_DIR)) {
        process.stderr.write(`❌  lint_archived_skills: ${ARCHIVE_DIR} missing\n`);
        return 1;
    }

    const notes = archived_slugs();
    const live = live_skill_slugs();

    // The scanned unit is the LIVE skills tree, not the archive notes. Zero
    // notes is a real success state (nothing has been archived yet), but three
    // of the five contract checks — replacement-resolves, no-zombie, and the
    // replaced_by cross-check — are decided entirely by `live`, so an empty or
    // moved skills root silently answers "no zombies, all replacements fine".
    try {
        assertScanned({
            gate: 'lint_archived_skills',
            scanned: live.size,
            units: 'live skill(s)',
            roots: ALL_SKILLS_DIRS.map((d) => path.relative(REPO, d)),
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const errors: string[] = [];

    const archivedKeys = new Set<string>();
    for (const note of notes) {
        const noteName = path.basename(note);
        const text = fs.readFileSync(note, 'utf-8');
        const fm = parse_frontmatter(text);
        const slugFromName = noteName.replace(/\.md$/, '');

        if (fm === null) {
            errors.push(`${noteName}: missing or malformed frontmatter`);
            continue;
        }

        const missing = REQUIRED_FIELDS.filter((f) => !(f in fm));
        if (missing.length) {
            errors.push(`${noteName}: missing required fields: ${missing.join(', ')}`);
            continue;
        }

        if (fm['slug'] !== slugFromName) {
            errors.push(
                `${noteName}: slug field '${fm['slug']}' != filename stem '${slugFromName}'`,
            );
        }

        if (!DATE_RE.test(fm['archived_on'] as string)) {
            errors.push(`${noteName}: archived_on '${fm['archived_on']}' is not YYYY-MM-DD`);
        }

        if (!VALID_REASONS.has(fm['reason'] as string)) {
            errors.push(
                `${noteName}: reason '${fm['reason']}' not in ${_sortedListRepr(VALID_REASONS)}`,
            );
        }

        if (!_isInt(fm['last_seen_count'] as string)) {
            errors.push(
                `${noteName}: last_seen_count '${fm['last_seen_count']}' is not an integer`,
            );
        }

        const replacement = fm['replacement'] as string;
        const reason = fm['reason'] as string;
        const skillsLabel = SKILLS_DIRS.join(', ') || '<no skills root>';
        if (reason === 'merged' || reason === 'superseded') {
            if (replacement === 'none' || !replacement) {
                errors.push(
                    `${noteName}: reason=${reason} requires a replacement slug, got 'none'`,
                );
            } else if (!live.has(replacement)) {
                errors.push(
                    `${noteName}: replacement '${replacement}' not found under ${skillsLabel}`,
                );
            }
        } else if (reason === 'unused' || reason === 'deprecated') {
            if (replacement !== 'none' && replacement !== '') {
                if (!live.has(replacement)) {
                    errors.push(
                        `${noteName}: replacement '${replacement}' not found under ${skillsLabel}`,
                    );
                }
            }
        }

        if (live.has(fm['slug'] as string)) {
            errors.push(`${noteName}: slug '${fm['slug']}' still has a live SKILL.md (zombie)`);
        }

        archivedKeys.add(fm['slug'] as string);
    }

    // Cross-check: live skills must not list an archived slug as replaced_by.
    for (const skillsDir of SKILLS_DIRS) {
        for (const name of _iterdir(skillsDir).sort()) {
            const skillDir = path.join(skillsDir, name);
            const skillMd = path.join(skillDir, 'SKILL.md');
            if (!_exists(skillMd)) {
                continue;
            }
            const text = fs.readFileSync(skillMd, 'utf-8');
            const fm = parse_frontmatter(text);
            if (fm === null) {
                continue;
            }
            const rb = (fm['replaced_by'] ?? '').trim();
            if (rb && archivedKeys.has(rb)) {
                errors.push(
                    `${name}/SKILL.md: replaced_by '${rb}' points at an archived slug`,
                );
            }
        }
    }

    // Rule 6 — removals that never entered the ledger.
    const removalCheck = removed_without_note(REPO, archivedKeys, live);
    if ('skipped' in removalCheck) {
        process.stdout.write(`rule 6 skipped: ${removalCheck.skipped}\n`);
    } else {
        for (const slug of removalCheck.removed) {
            errors.push(
                `${slug}: SKILL.md removed since the base ref with no ` +
                    `agents/evidence/archived-skills/${slug}.md note`,
            );
        }
    }

    if (errors.length) {
        process.stderr.write(
            `❌  lint_archived_skills: ${errors.length} violation(s) across ${notes.length} note(s)\n`,
        );
        for (const e of errors) {
            process.stderr.write(`    ${e}\n`);
        }
        return 1;
    }

    if (!QUIET) {
        process.stdout.write(
            `✅  lint_archived_skills: ${notes.length} archive note(s), contract holds\n`,
        );
    }
    return 0;
}

/**
 * Rule 6 — a slug that left the tree without entering the ledger.
 *
 * WHY THIS LIVES IN THE GATE AND NOT IN A SCAFFOLDER. The roadmap step that
 * asked for this (`road-to-skill-link-integrity-and-manifest-sync` Phase 1
 * Step 3) named `src/scripts/new_skill.ts --archive` as the extension point,
 * on the premise that it is "a creation path with no symmetric removal path".
 * That premise is false: `new_skill.ts` scaffolds into a `packages/<pack>/`
 * container that ADR-051 retired, and its `main()` returns exit 2 with
 * `error: no packages/ tree found` in this tree, because skill authoring moved
 * to `src/skills/`. A mode added there could not run.
 *
 * The obligation is a CI property, not a tool property, and the distinction is
 * the reason the ledger is empty: nothing forces a maintainer or an agent to
 * delete a directory *through* a tool, so a scaffolder mode is a bypass by
 * construction. Three slugs left this tree without a note while
 * `agents/evidence/archived-skills/` held only a README.
 *
 * A RENAME IS A REMOVAL HERE, DELIBERATELY. Git would call
 * `verify-before-complete` → `verify-completion-evidence` a rename; every link
 * to the old slug still broke, and repairing eight of them is what produced
 * this rule. So the old slug owes a note.
 *
 * THE COMPARISON IS AGAINST THE MERGE BASE, NOT THE TIP OF MAIN, and this was
 * found the hard way: the first run of this rule reported `js-library-packaging`
 * and `storybook-workshop` as unnoted removals. Neither had been removed — both
 * were ADDED on main after this branch forked, so a branch that is merely
 * BEHIND its base read every new skill as a deletion. That is the false-red
 * class `_lib/ratchet_base_ref.ts` warns about in its own docstring ("the gate
 * gets a reputation for false reds, and someone turns it off"). `git merge-base`
 * answers the question the rule actually asks — did THIS branch remove it —
 * because a skill added on main after the fork is not in the merge base at all.
 *
 * THE SKIP IS STATED, NEVER SILENT. With no resolvable base ref there is no
 * "before" side, and comparing against an assumed-empty base would report every
 * skill in the tree as removed. `resolveBaseRef` returns null in that case and
 * this returns a `skipped` reason the caller prints — the honest default named
 * in that helper's own contract. It is also blind to an uncommitted removal;
 * CI is the authoritative gate and CI only ever sees committed work.
 */
export function removed_without_note(
    repoRoot: string = REPO,
    archived: ReadonlySet<string> = new Set(archived_slugs()),
    liveSlugs: ReadonlySet<string> = new Set(live_skill_slugs()),
): { skipped: string } | { removed: string[] } {
    const base = resolveBaseRef(repoRoot);
    if (base === null) {
        return { skipped: 'no base ref resolved — nothing to compare against' };
    }
    const mb = spawnSync('git', ['merge-base', 'HEAD', base], {
        cwd: repoRoot,
        encoding: 'utf-8',
    });
    // A missing merge base is not "compare against the tip instead" — that is
    // the false-red above. It is no comparable before-side at all.
    const forkPoint = mb.status === 0 ? String(mb.stdout).trim() : '';
    if (!forkPoint) {
        return { skipped: `no merge base between HEAD and ${base}` };
    }
    const res = spawnSync(
        'git',
        ['ls-tree', '-r', '--name-only', forkPoint, '--', 'src/skills'],
        { cwd: repoRoot, encoding: 'utf-8' },
    );
    if (res.status !== 0) {
        return { skipped: `git ls-tree ${forkPoint} failed — base ref is not readable here` };
    }
    const atBase = new Set<string>();
    for (const line of String(res.stdout).split('\n')) {
        const m = /^src\/skills\/([^/]+)\/SKILL\.md$/.exec(line.trim());
        if (m) atBase.add(m[1] as string);
    }
    const removed = [...atBase].filter((slug) => !liveSlugs.has(slug) && !archived.has(slug)).sort();
    return { removed };
}

// --- helpers --------------------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _iterdir(p: string): string[] {
    try {
        return fs.readdirSync(p);
    } catch {
        return [];
    }
}

function _isInt(s: string): boolean {
    // Mirror Python int(str): accepts optional sign + digits, with optional
    // surrounding whitespace and underscores-between-digits NOT accepted here
    // for fidelity to common archive-note ints. Python int() accepts leading
    // whitespace and a sign; replicate that.
    return /^[+-]?\d+$/.test(s.trim());
}

/** Mirror Python `sorted(set)` repr as a list literal of single-quoted strings. */
function _sortedListRepr(s: Set<string>): string {
    const items = [...s].sort();
    return '[' + items.map((x) => `'${x}'`).join(', ') + ']';
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
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

export {
    REPO,
    ARCHIVE_DIR,
    SKILLS_DIRS,
    REQUIRED_FIELDS,
    VALID_REASONS,
    parse_frontmatter,
    archived_slugs,
    live_skill_slugs,
    main,
};
