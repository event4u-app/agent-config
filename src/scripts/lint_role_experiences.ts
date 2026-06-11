#!/usr/bin/env tsx
/**
 * Linter for `agents/roles/<slug>/` role experiences.
 *
 * TypeScript twin of `src/scripts/lint_role_experiences.py` (ADR-089,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY —
 * `--plain-language` flag, exit codes (0 pass / roles-dir-absent,
 * 1 failures), stdout/stderr split (all output on stdout), byte-identical
 * finding messages (including Python `sorted(set)` list repr), same scan
 * order, same `yaml.safe_load` frontmatter parser, same status↔
 * recruit_session_ref coupling.
 *
 * Asserts the structural floor pinned in docs/contracts/role-experience.md.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ROLES_DIR = path.join(ROOT, 'agents', 'roles');
const SKILL_SOURCES = [
    path.join(ROOT, '.agent-src.uncondensed', 'skills'),
    path.join(ROOT, 'dist/agent-src', 'skills'),
];

const REQUIRED_INDEX_KEYS = new Set([
    'role',
    'display_name',
    'tagline',
    'recommended_packs',
    'install_path_hint',
    'recruit_session_ref',
    'status',
]);

const REQUIRED_PROMPT_KEYS = new Set([
    'name',
    'intent',
    'inputs',
    'output_shape',
    'skill_hint',
]);

const VALID_STATUS = new Set(['draft', 'beta-internal', 'beta', 'stable']);
const EXTERNAL_VALIDATED_STATUS = new Set(['beta', 'stable']);

const MIN_FIRST_TASKS = 3;
const MIN_PROMPTS_PER_ROLE = 5;

// re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n", re.DOTALL) anchored at start.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const TASK_HEADING_RE = /^## Three first tasks[ \t]*$/m;
const TASK_ITEM_RE = /^[ \t]*\d+\.[ \t]+\*\*[^*]+\*\*/gm;

const PLAIN_LANGUAGE_JARGON = [
    'council',
    'trust level',
    'pack',
    'orchestration',
    'contract',
    'advisory',
];

function parse_frontmatter(text: string): [Record<string, unknown>, string] {
    const m = FRONTMATTER_RE.exec(text);
    if (m === null) {
        return [{}, text];
    }
    let loaded: unknown;
    try {
        loaded = parseYaml(m[1] as string, { version: '1.1' }) ?? {};
    } catch {
        return [{}, text.slice(m[0].length)];
    }
    if (!isPlainObject(loaded)) {
        return [{}, text.slice(m[0].length)];
    }
    return [loaded as Record<string, unknown>, text.slice(m[0].length)];
}

function count_first_tasks(body: string): number {
    TASK_HEADING_RE.lastIndex = 0;
    const headingMatch = TASK_HEADING_RE.exec(body);
    if (headingMatch === null) {
        return 0;
    }
    const after = body.slice(headingMatch.index + headingMatch[0].length);
    const nextRe = /^## /m;
    const nextSection = nextRe.exec(after);
    const section = nextSection ? after.slice(0, nextSection.index) : after;
    TASK_ITEM_RE.lastIndex = 0;
    const matches = section.match(TASK_ITEM_RE);
    return matches ? matches.length : 0;
}

function all_skills(): Set<string> {
    const found = new Set<string>();
    for (const src of SKILL_SOURCES) {
        if (!_exists(src)) {
            continue;
        }
        for (const name of _iterdir(src)) {
            if (_isDir(path.join(src, name))) {
                found.add(name);
            }
        }
    }
    return found;
}

function lint_role(roleDir: string, knownSkills: Set<string>, failures: string[]): void {
    const slug = path.basename(roleDir);
    if (slug.startsWith('_') || slug.startsWith('.')) {
        return;
    }

    const indexPath = path.join(roleDir, 'index.md');
    const skillsPath = path.join(roleDir, 'skills.yml');

    if (!_exists(indexPath)) {
        failures.push(`${roleDir}: missing index.md`);
        return;
    }
    if (!_exists(skillsPath)) {
        failures.push(`${roleDir}: missing skills.yml`);
        return;
    }

    const [fm, body] = parse_frontmatter(fs.readFileSync(indexPath, 'utf-8'));
    const missingKeys = _setDiff(REQUIRED_INDEX_KEYS, new Set(Object.keys(fm)));
    if (missingKeys.size) {
        failures.push(`${indexPath}: missing frontmatter keys: ${_sortedListRepr(missingKeys)}`);
    }

    const status = fm['status'];
    if (typeof status !== 'string' || !VALID_STATUS.has(status)) {
        failures.push(`${indexPath}: status ${_pyRepr(status)} not in ${_sortedListRepr(VALID_STATUS)}`);
    } else if (EXTERNAL_VALIDATED_STATUS.has(status) && !_truthy(fm['recruit_session_ref'])) {
        failures.push(
            `${indexPath}: status '${status}' requires a non-null ` +
                'recruit_session_ref (external-validation gate); use ' +
                "'beta-internal' for the internal-authoring basis",
        );
    }

    const firstTasks = count_first_tasks(body);
    if (firstTasks < MIN_FIRST_TASKS) {
        failures.push(
            `${indexPath}: requires ≥ ${MIN_FIRST_TASKS} first tasks, found ${firstTasks}`,
        );
    }

    const promptsDir = path.join(roleDir, 'prompts');
    const prompts = _exists(promptsDir)
        ? _iterdir(promptsDir)
              .filter((n) => n.endsWith('.md'))
              .map((n) => path.join(promptsDir, n))
              .sort()
        : [];
    if (prompts.length < MIN_PROMPTS_PER_ROLE) {
        failures.push(
            `${roleDir}: requires ≥ ${MIN_PROMPTS_PER_ROLE} prompts in prompts/, ` +
                `found ${prompts.length}`,
        );
    }

    for (const promptPath of prompts) {
        const [promptFm] = parse_frontmatter(fs.readFileSync(promptPath, 'utf-8'));
        const missing = _setDiff(REQUIRED_PROMPT_KEYS, new Set(Object.keys(promptFm)));
        if (missing.size) {
            failures.push(`${promptPath}: missing frontmatter keys: ${_sortedListRepr(missing)}`);
        }
    }

    let skillsDoc: unknown;
    try {
        skillsDoc = parseYaml(fs.readFileSync(skillsPath, 'utf-8'), { version: '1.1' }) ?? {};
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        failures.push(`${skillsPath}: malformed YAML (${msg})`);
        return;
    }
    const skillEntries = _get(skillsDoc, 'skills') ?? [];
    if (!Array.isArray(skillEntries)) {
        failures.push(`${skillsPath}: \`skills:\` must be a list`);
        return;
    }
    for (const entry of skillEntries) {
        if (!isPlainObject(entry)) {
            failures.push(`${skillsPath}: skill entry is not a mapping: ${_pyRepr(entry)}`);
            continue;
        }
        const skillId = (entry as Record<string, unknown>)['id'];
        if (typeof skillId !== 'string') {
            failures.push(`${skillsPath}: skill entry missing \`id\`: ${_pyRepr(entry)}`);
            continue;
        }
        if (knownSkills.size && !knownSkills.has(skillId)) {
            failures.push(
                `${skillsPath}: skill \`${skillId}\` does not resolve to an existing skill`,
            );
        }
    }
}

function lint_plain_language(failures: string[]): void {
    for (const name of _iterdir(ROLES_DIR).sort()) {
        const roleDir = path.join(ROLES_DIR, name);
        if (!_isDir(roleDir) || name.startsWith('_') || name.startsWith('.')) {
            continue;
        }
        const indexPath = path.join(roleDir, 'index.md');
        if (!_exists(indexPath)) {
            continue;
        }
        const [, body] = parse_frontmatter(fs.readFileSync(indexPath, 'utf-8'));
        const bodyStripped = body.replace(/```[\s\S]*?```/g, '');
        for (const term of PLAIN_LANGUAGE_JARGON) {
            const pattern = new RegExp(`\\b${_reEscape(term)}\\b`, 'i');
            if (pattern.test(bodyStripped)) {
                failures.push(
                    `${indexPath}: contains the jargon term \`${term}\` ` +
                        '(see docs/contracts/plain-language-surface.md)',
                );
            }
        }
    }
}

interface Args {
    plainLanguage: boolean;
}

function parse_args(argv: readonly string[]): Args {
    let plainLanguage = false;
    for (const arg of argv) {
        if (arg === '--plain-language') {
            plainLanguage = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_role_experiences [-h] [--plain-language]\n');
            process.exit(0);
        } else {
            process.stderr.write(`lint_role_experiences: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
    return { plainLanguage };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (!_exists(ROLES_DIR)) {
        process.stdout.write(`lint_role_experiences: roles dir not found at ${ROLES_DIR}\n`);
        return 0;
    }

    const knownSkills = all_skills();
    const failures: string[] = [];
    for (const name of _iterdir(ROLES_DIR).sort()) {
        const roleDir = path.join(ROLES_DIR, name);
        if (_isDir(roleDir)) {
            lint_role(roleDir, knownSkills, failures);
        }
    }

    if (args.plainLanguage) {
        lint_plain_language(failures);
    }

    if (failures.length) {
        for (const f of failures) {
            process.stdout.write(`❌ ${f}\n`);
        }
        process.stdout.write(`\nlint_role_experiences: ${failures.length} failure(s)\n`);
        return 1;
    }
    process.stdout.write('✅ lint_role_experiences: all role experiences pass\n');
    return 0;
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

function _iterdir(p: string): string[] {
    try {
        return fs.readdirSync(p);
    } catch {
        return [];
    }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _get(obj: unknown, key: string): unknown {
    return isPlainObject(obj) ? (obj as Record<string, unknown>)[key] : undefined;
}

/** Python truthiness for `fm.get("recruit_session_ref")` — null/""/0/false → false. */
function _truthy(v: unknown): boolean {
    if (v === null || v === undefined || v === false) {
        return false;
    }
    if (v === '') {
        return false;
    }
    if (v === 0) {
        return false;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (isPlainObject(v)) {
        return Object.keys(v).length > 0;
    }
    return true;
}

function _setDiff(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set<string>();
    for (const x of a) {
        if (!b.has(x)) {
            out.add(x);
        }
    }
    return out;
}

function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mirror Python `sorted(set)` repr as a list literal of single-quoted strings. */
function _sortedListRepr(s: Set<string>): string {
    return '[' + [...s].sort().map((x) => `'${x}'`).join(', ') + ']';
}

/** Python repr() for a scalar value embedded in a finding (status {!r}). */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (typeof value === 'string') {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _pyRepr(v)).join(', ') + ']';
    }
    if (isPlainObject(value)) {
        const parts = Object.entries(value as Record<string, unknown>).map(
            ([k, v]) => `${_pyRepr(k)}: ${_pyRepr(v)}`,
        );
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    ROOT,
    ROLES_DIR,
    REQUIRED_INDEX_KEYS,
    REQUIRED_PROMPT_KEYS,
    VALID_STATUS,
    EXTERNAL_VALIDATED_STATUS,
    parse_frontmatter,
    count_first_tasks,
    all_skills,
    lint_role,
    lint_plain_language,
    parse_args,
    main,
};
