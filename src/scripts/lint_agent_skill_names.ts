#!/usr/bin/env tsx
// Agent-Skills name-compliance linter (2026-06 Zed fix).
//
// TypeScript port of the retired Python src/scripts/lint_agent_skill_names.py — same two
// blocking checks (command name == path-derived slug; skill name == dir),
// same Agent-Skills name pattern, same stdout/stderr split, same exit codes
// (0 clean / 1 violations / 3 internal error), same `--quiet` flag.
//
// Strict Agent-Skills consumers (Zed, Anthropic skill validators) require a
// skill `name:` to (a) match `^[a-z0-9]+(-[a-z0-9]+)*$`, (b) be at most 64
// characters, and (c) equal the directory name the SKILL.md lives in.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { command_slug } from './_lib/agent_src.js';
import { is_claude_builtin_name } from './_lib/claude_builtin_names.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(SCRIPTS_DIR));
const SRC_DOMAINS = path.join(ROOT, 'src', 'domains');
const SRC_SKILLS = path.join(ROOT, 'src', 'skills');
const TWIN_BASELINE = path.join(ROOT, 'src', 'config', 'name-twin-baseline.json');

// Agent-Skills spec name shape: lowercase letters, digits, single hyphens,
// no leading/trailing hyphen, 1-64 chars.
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LEN = 64;

const NAME_RE = /^name:\s*(.*)$/m;

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Recursively collect files named `command.md`, sorted by POSIX path. */
function rglobNamed(dir: string, name: string): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) {
                walk(full);
            } else if (e.isFile() && e.name === name) {
                out.push(full);
            }
        }
    };
    walk(dir);
    // Python's Path.rglob results are then sorted() — POSIX string sort.
    out.sort((a, b) => {
        const pa = a.split(path.sep).join('/');
        const pb = b.split(path.sep).join('/');
        return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
    return out;
}

function relToRoot(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}

export function _frontmatter_name(text: string): string | null {
    if (!text.startsWith('---')) {
        return null;
    }
    const end = text.indexOf('\n---', 3);
    const block = end !== -1 ? text.slice(3, end) : text;
    const m = NAME_RE.exec(block);
    if (!m || m[1] === undefined) {
        return null;
    }
    // .strip().strip('"').strip("'")
    let v = m[1].trim();
    v = v.replace(/^"+|"+$/g, '');
    v = v.replace(/^'+|'+$/g, '');
    return v;
}

function frontmatterNameFromFile(p: string): string | null {
    return _frontmatter_name(fs.readFileSync(p, 'utf-8'));
}

/**
 * A reserved name is a violation whatever the frontmatter declares: the
 * `text` is accepted and deliberately not consulted, because
 * `user-invocable: false` only controls who may invoke the skill — the host
 * still resolves `/name` to it, so the built-in stays shadowed.
 */
export function _reserved_name_violation(dirname: string, _text: string): string | null {
    if (!is_claude_builtin_name(dirname)) {
        return null;
    }
    return (
        `\`${dirname}\` is a Claude Code built-in command name — rename the ` +
        'skill; `user-invocable: false` does not give the name back, and the ' +
        'suite must never shadow a host built-in'
    );
}

export function _spec_violation(name: string): string | null {
    if (name.length > MAX_NAME_LEN) {
        return `longer than ${MAX_NAME_LEN} chars`;
    }
    if (!NAME_PATTERN.test(name)) {
        return (
            'must contain only lowercase letters, numbers, and single ' +
            'hyphens (no leading/trailing/double hyphen, no `:`)'
        );
    }
    return null;
}

export function check_commands(): string[] {
    const violations: string[] = [];
    if (!isDir(SRC_DOMAINS)) {
        return violations;
    }
    for (const md of rglobNamed(SRC_DOMAINS, 'command.md')) {
        const slug = command_slug(md);
        if (slug === null) {
            continue;
        }
        const rel = relToRoot(md);
        const name = frontmatterNameFromFile(md);
        if (!name) {
            violations.push(`${rel}: missing \`name:\` frontmatter`);
            continue;
        }
        const spec = _spec_violation(name);
        if (spec) {
            violations.push(`${rel}: name \`${name}\` ${spec}`);
        }
        if (name !== slug) {
            violations.push(
                `${rel}: name \`${name}\` != path-derived slug \`${slug}\` — ` +
                    'the slug is the `.claude/skills/` directory name; they ' +
                    'must match so strict Agent-Skills consumers (Zed) accept ' +
                    'the projected SKILL.md',
            );
        }
    }
    return violations;
}

export function check_skills(): string[] {
    const violations: string[] = [];
    if (!isDir(SRC_SKILLS)) {
        return violations;
    }
    const dirs = fs
        .readdirSync(SRC_SKILLS, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(SRC_SKILLS, e.name))
        .sort((a, b) => {
            const pa = a.split(path.sep).join('/');
            const pb = b.split(path.sep).join('/');
            return pa < pb ? -1 : pa > pb ? 1 : 0;
        });
    for (const skillDir of dirs) {
        const md = path.join(skillDir, 'SKILL.md');
        if (!isFile(md)) {
            continue;
        }
        const rel = relToRoot(md);
        const dirname = path.basename(skillDir);
        const spec = _spec_violation(dirname);
        if (spec) {
            violations.push(`${rel}: directory \`${dirname}\` ${spec}`);
        }
        const name = frontmatterNameFromFile(md);
        if (!name) {
            violations.push(`${rel}: missing \`name:\` frontmatter`);
            continue;
        }
        if (name !== dirname) {
            violations.push(
                `${rel}: name \`${name}\` != directory \`${dirname}\` — Zed ` +
                    'requires the folder name to match the `name:` field',
            );
        }
        // Reserved set: src/scripts/_lib/claude_builtin_names.ts.
        const reserved = _reserved_name_violation(dirname, fs.readFileSync(md, 'utf-8'));
        if (reserved) {
            violations.push(`${rel}: ${reserved}`);
        }
    }
    return violations;
}

/**
 * Skill/command same-name twins against a shrink-only baseline: a twin the
 * baseline does not list fails, and so does a listed twin that no longer
 * exists — otherwise a stale line would be headroom for the next twin.
 */
export function _twin_violations(
    skill_names: readonly string[],
    command_names: readonly string[],
    baseline: readonly string[],
): string[] {
    const commands = new Set(command_names);
    const twins = new Set(skill_names.filter((n) => commands.has(n)));
    const listed = new Set(baseline);
    const violations: string[] = [];
    for (const name of [...twins].sort()) {
        if (!listed.has(name)) {
            violations.push(
                `\`${name}\` is both a skill directory and a command \`name:\` — ` +
                    'two artefacts may not share one name; rename one ' +
                    '(src/config/name-twin-baseline.json lists the existing twins and never grows)',
            );
        }
    }
    for (const name of [...listed].sort()) {
        if (!twins.has(name)) {
            violations.push(
                `src/config/name-twin-baseline.json: \`${name}\` is no longer a twin — ` +
                    'delete its line; the baseline only shrinks',
            );
        }
    }
    return violations;
}

function read_twin_baseline(): string[] {
    const doc = JSON.parse(fs.readFileSync(TWIN_BASELINE, 'utf-8')) as {
        twins?: ReadonlyArray<{ name?: unknown }>;
    };
    return (doc.twins ?? []).map((t) => {
        if (typeof t.name !== 'string') {
            throw new Error('name-twin-baseline.json: every twin needs a string `name`');
        }
        return t.name;
    });
}

export function check_twins(): string[] {
    if (!isDir(SRC_SKILLS) || !isDir(SRC_DOMAINS)) {
        return [];
    }
    const skills = fs
        .readdirSync(SRC_SKILLS, { withFileTypes: true })
        .filter((e) => e.isDirectory() && isFile(path.join(SRC_SKILLS, e.name, 'SKILL.md')))
        .map((e) => e.name);
    const commands = rglobNamed(SRC_DOMAINS, 'command.md')
        .map((md) => frontmatterNameFromFile(md))
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
    return _twin_violations(skills, commands, read_twin_baseline());
}

function parse_args(argv: readonly string[]): { quiet: boolean } {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_agent_skill_names.py [-h] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(
                `lint_agent_skill_names.py: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        }
    }
    return { quiet };
}

export function main(argv?: readonly string[]): number {
    const { quiet } = parse_args(argv ?? process.argv.slice(2));

    // Both check_* helpers return [] on a missing root, so a moved src/domains
    // or src/skills reads as "all names compliant". Count the name-bearing
    // files themselves — the two roots are summed because either one alone
    // going dead still leaves the other's names checked, and the ✅ line claims
    // BOTH surfaces. Exit 3 is this gate's internal-error code: a dead scope is
    // the linter failing to run, not a name violation (1).
    const scanned =
        (isDir(SRC_DOMAINS) ? rglobNamed(SRC_DOMAINS, 'command.md').length : 0) +
        (isDir(SRC_SKILLS)
            ? fs
                  .readdirSync(SRC_SKILLS, { withFileTypes: true })
                  .filter((e) => e.isDirectory() && isFile(path.join(SRC_SKILLS, e.name, 'SKILL.md')))
                  .length
            : 0);
    try {
        assertScanned({
            gate: 'lint_agent_skill_names',
            scanned,
            units: 'command.md + SKILL.md file(s)',
            roots: ['src/domains', 'src/skills'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 3;
        }
        throw exc;
    }

    let violations: string[];
    try {
        violations = [...check_commands(), ...check_skills(), ...check_twins()];
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  lint-skill-names internal error: ${msg}\n`);
        return 3;
    }

    if (violations.length > 0) {
        process.stdout.write(`❌  ${violations.length} Agent-Skills name violation(s):\n`);
        for (const v of violations) {
            process.stdout.write(`  • ${v}\n`);
        }
        process.stdout.write(
            '\nNames must be the path-derived hyphen slug ' +
                '(command.schema.json `name` pattern; 2026-06 Zed fix).\n',
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            '✅  All command + skill names are Agent-Skills-spec compliant ' +
                '(hyphen slugs, name == directory/slug).\n',
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
