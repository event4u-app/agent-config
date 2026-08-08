#!/usr/bin/env tsx
/**
 * CI guard: council config lives in `.ai-council.yml`, never `.agent-settings.yml`.
 *
 * Ported from the retired Python `src/scripts/check_council_config_location.py` (ADR-200).
 * The original two checks keep their pinned CLI contract — `--quiet` flag,
 * exit codes (0 clean, 1 at least one violation), byte-identical finding
 * messages, same `SCAN_GLOBS` (sorted), same fence tracking, same negation /
 * `ai_council:` block detection, and the same `<!-- council-config-allowed -->`
 * escape pragma.
 *
 * Additive since ADR-104: a third check (§3 below) flags project-tree
 * *placement* of the council file. The original two checks are unchanged; the
 * path check runs over its own `PATH_CHECK_GLOBS` (the council surfaces + the
 * settings template + the `.ai-council.yml.example`) so the settings template's
 * many legitimate `.agent-settings.yml` self-references never trip check §1.
 *
 * Per ADR-104 (superseding ADR-093) the council reads a dedicated
 * `.ai-council.yml` resolved ALWAYS from the user-global location
 * (`~/.event4u/agent-config/settings/.ai-council.yml`) — the project tree
 * is never searched (the only escape is the explicit `$AI_COUNCIL_CONFIG`
 * path). Keys are top-level in that file; the legacy `ai_council.*` block
 * under `.agent-settings.yml` was removed in Phase 0.
 *
 * What it flags:
 *
 *   1. A `.agent-settings.yml` reference that is NOT negated — i.e. an
 *      instruction to read/use it for council config. Corrective mentions
 *      ("NOT in `.agent-settings.yml`", "was removed", "never read") carry a
 *      negation marker on the same line and are allowed. (SCAN_GLOBS)
 *   2. A bare `ai_council:` YAML parent-block declaration — post-ADR-093 the
 *      keys are top-level in `.ai-council.yml`; there is no `ai_council:`
 *      namespace to nest under. (SCAN_GLOBS)
 *   3. A project-tree PLACEMENT of the council file — `agents/.ai-council.yml`,
 *      `agents/settings/.ai-council.yml`, or a `<project_root>/…/.ai-council.yml`
 *      path — that is NOT negated. The council file is user-global ONLY
 *      (ADR-104); any project-tree path is drift. Corrective mentions ("is
 *      ignored", "never read", "no project-local", "superseded") pass on the
 *      same line. (PATH_CHECK_GLOBS)
 *   4. NO always-loaded carrier for the user-global fact. §1–§3 keep the tree
 *      honest but say nothing about REACH: before this check the fact lived
 *      only in `src/skills/ai-council/SKILL.md`, a skill body that reaches
 *      context only on activation, so consumer sessions repeatedly inferred
 *      "council not configured" from a missing `.agent-settings.yml` while the
 *      council was configured all along. §4 requires one rule under
 *      `src/rules/` to carry the fact and to project at least as widely as the
 *      kernel reference. (RULES_GLOB)
 *
 * Escape hatch: a line carrying `<!-- council-config-allowed -->` is exempt
 * (for a legitimate non-council `.agent-settings.yml` reference, e.g.
 * `personal.autonomy`, or a historical placement mention in a section
 * explicitly marked superseded).
 *
 * Exit codes:
 *   0 — clean.
 *   1 — at least one violation; details printed to stdout.
 *
 * Invocation (from project root):
 *   tsx src/scripts/check_council_config_location.ts [--quiet]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const QUIET = process.argv.includes('--quiet');

// Agent-facing surfaces where council config must resolve to `.ai-council.yml`.
// Globs are relative to the repo root; non-existent paths are skipped silently.
const SCAN_GLOBS = [
    'src/domains/meta/council/**/*.md',
    'src/domains/product-basic/roadmap/ai-council/**/*.md',
    'src/skills/ai-council/**/*.md',
    'src/rules/council-availability.md',
    'docs/contracts/ai-council-config.md',
] as const;

const AGENT_SETTINGS_RE = /\.agent-settings\.yml/;
// A negation marker on the same line marks a corrective reference (allowed).
const NEGATION_RE = /\b(not|never|removed|no\s+longer|neither|instead)\b/i;
// A YAML parent-block declaration: `ai_council:` alone (optionally indented,
// optional trailing comment). Inline-code mentions like `under `ai_council:``
// do not match because the line does not START with the key.
const AI_COUNCIL_BLOCK_RE = /^\s*ai_council:\s*(#.*)?$/;
const ALLOW_PRAGMA = '<!-- council-config-allowed -->';

// ── §3 project-tree placement check (ADR-104) ──────────────────────
// The council file is user-global ONLY. These are the surfaces where a
// stray project-tree placement instruction does real damage — the council
// command/skill surfaces + contract (SCAN_GLOBS) PLUS the settings template
// and the copy-from example. The template carries countless legitimate
// `.agent-settings.yml` self-references, so it is scanned ONLY by §3, never
// by §1.
const PATH_CHECK_GLOBS = [
    ...SCAN_GLOBS,
    'src/config/agent-settings.template.yml',
    'agents/templates/.ai-council.yml.example',
] as const;

// A project-tree PLACEMENT of the council file: `agents/.ai-council.yml`,
// `agents/settings/.ai-council.yml`, or any `<project_root>/…/.ai-council.yml`.
// Deliberately does NOT match the user-global `…/agent-config/settings/
// .ai-council.yml` (no literal `agents/` segment) nor the copy-from
// `agents/templates/.ai-council.yml.example` (segment is `templates/`, and
// `.example` is not the config file).
const PROJECT_PATH_COUNCIL_RE =
    /(?:agents\/(?:settings\/)?\.ai-council\.yml(?!\.example)|<project[_-]?root>[^\n`]*\.ai-council\.yml)/;

// Broader negation set for §3 — corrective placement mentions use vocabulary
// the §1 NEGATION_RE does not cover ("is ignored", "no project-local
// lookup", "superseded"). A match on the same line marks the reference
// corrective and is allowed.
const PATH_NEGATION_RE =
    /\b(not|never|removed|no\s+longer|neither|instead|ignored|superseded|no\s+project-local|not\s+read|does\s+not\s+read)\b/i;

// ── §4 always-loaded carrier check ─────────────────────────────────
// The user-global fact is useless where the agent cannot see it. Before this
// check the fact lived only in `src/skills/ai-council/SKILL.md` — a skill body
// that only reaches context on activation — so consumer sessions repeatedly
// inferred "council not configured" from a missing `.agent-settings.yml` and
// substituted a subagent fan-out while the council was configured all along.
// §4 pins the fix: at least one rule under `src/rules/` must carry the fact,
// declare a council trigger, and project at least as widely as the kernel.
const RULES_GLOB = 'src/rules/**/*.md';
// Reference for the reach requirement: a carrier scoped more narrowly than an
// always-loaded kernel rule would not reach the consumer repos that failed.
const REACH_REFERENCE_RULE = 'src/rules/direct-answers.md';
const WORKSPACES_RE = /^workspaces:\s*\[([^\]]*)\]/m;
// The three markers a carrier must show, all in the same file.
const CARRIER_MARKERS = [
    {
        re: /^\s*-\s*keyword:\s*"council"\s*$/m,
        what: 'a `- keyword: "council"` trigger',
    },
    {
        re: /~\/\.event4u\/agent-config\/settings\/\.ai-council\.yml/,
        what: 'the one real user-global config path',
    },
    {
        re: /NEVER\s+INFER\s+"NOT\s+CONFIGURED"/i,
        what: 'the never-infer-from-project-files obligation',
    },
] as const;

/**
 * Mirror Python `str.lstrip()` — strips all leading Unicode whitespace.
 * Python's `str.lstrip()` (no args) strips the Unicode whitespace class;
 * JS `\s` in a regex covers the same set for the characters that occur in
 * source files. Use a regex to match Python's behaviour precisely.
 */
function _lstrip(s: string): string {
    return s.replace(/^\s+/, '');
}

/**
 * Yield matching files in sorted, de-duplicated order. Mirrors the Python
 * generator: each glob's matches are sorted, files only, first-seen wins.
 *
 * Python `Path.glob` with `**` matches across directory boundaries and follows
 * the same sort (component-wise via Path comparison). We approximate with a
 * recursive walk per glob pattern, sorting POSIX paths.
 */
function* iter_files(
    root: string,
    globs: readonly string[] = SCAN_GLOBS,
): Generator<string> {
    const seen = new Set<string>();
    for (const pattern of globs) {
        for (const p of _glob(root, pattern)) {
            if (_isFile(p) && !seen.has(p)) {
                seen.add(p);
                yield p;
            }
        }
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
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

/**
 * Resolve a glob relative to `root` and return absolute paths, sorted the way
 * Python's `sorted(Path.glob(...))` sorts — component-wise on the PosixPath.
 * Supports the two shapes used here: a literal path, and `<dir>/**\/*.md`.
 */
function _glob(root: string, pattern: string): string[] {
    // Literal (no glob magic) — direct existence check.
    if (!pattern.includes('*')) {
        const full = path.join(root, pattern);
        return _isFile(full) ? [full] : [];
    }
    // Shape: <prefix>/**/*.md  → recursive *.md under <prefix>.
    const marker = '/**/';
    const idx = pattern.indexOf(marker);
    if (idx === -1) {
        return [];
    }
    const prefix = pattern.slice(0, idx);
    const suffixGlob = pattern.slice(idx + marker.length); // e.g. "*.md"
    if (suffixGlob !== '*.md') {
        return [];
    }
    const base = path.join(root, prefix);
    if (!_isDir(base)) {
        return [];
    }
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isFile() && ent.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(base);
    // Sort like Python's sorted() over PosixPath — component-wise. The POSIX
    // string form sorts equivalently for these repo-relative paths.
    out.sort(_pathSort);
    return out;
}

/** Component-wise path comparison matching PosixPath ordering. */
function _pathSort(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        if (pa[i] !== pb[i]) {
            return pa[i]! < pb[i]! ? -1 : 1;
        }
    }
    return pa.length - pb.length;
}

/** POSIX-style relative path (Path.relative_to(...).as_posix() / str()). */
function _relPosix(base: string, target: string): string {
    return path.relative(base, target).split(path.sep).join('/');
}

function find_violations(root: string): string[] {
    const findings: string[] = [];
    for (const p of iter_files(root)) {
        const rel = _relPosix(root, p);
        let in_fence = false;
        const lines = fs.readFileSync(p, 'utf-8').split('\n');
        // Python `.splitlines()` drops a trailing empty element when the text
        // ends with a newline; `.split('\n')` keeps it. Mirror splitlines by
        // dropping a single trailing '' produced by a final newline.
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        for (let i = 0; i < lines.length; i++) {
            const lineno = i + 1;
            const raw = lines[i]!;
            const stripped = _lstrip(raw);
            if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
                in_fence = !in_fence;
                continue;
            }
            if (raw.includes(ALLOW_PRAGMA)) {
                continue;
            }
            if (AGENT_SETTINGS_RE.test(raw) && !NEGATION_RE.test(raw)) {
                findings.push(
                    `${rel}:${lineno}: council config referenced via ` +
                        '`.agent-settings.yml` without a negation marker — council ' +
                        'config lives in `.ai-council.yml` (ADR-093). Point at the ' +
                        'resolved `.ai-council.yml`, or add a negation / ' +
                        `\`${ALLOW_PRAGMA}\` if this is a non-council reference.`,
                );
            }
            if (AI_COUNCIL_BLOCK_RE.test(raw)) {
                const where = in_fence ? 'fenced YAML' : 'prose';
                findings.push(
                    `${rel}:${lineno}: \`ai_council:\` parent block (${where}) — ` +
                        'post-ADR-093 the keys are top-level in `.ai-council.yml` ' +
                        '(no `ai_council:` wrapper).',
                );
            }
        }
    }
    return findings;
}

/**
 * §3 — flag project-tree PLACEMENT of the council config file (ADR-104).
 *
 * The council file is user-global only; any `agents/(settings/)?.ai-council.yml`
 * or `<project_root>/…/.ai-council.yml` path is drift. Corrective mentions
 * (same-line `PATH_NEGATION_RE`) and the `<!-- council-config-allowed -->`
 * pragma pass. Fenced code is skipped, mirroring §1/§2.
 */
function find_path_violations(root: string): string[] {
    const findings: string[] = [];
    for (const p of iter_files(root, PATH_CHECK_GLOBS)) {
        const rel = _relPosix(root, p);
        let in_fence = false;
        const lines = fs.readFileSync(p, 'utf-8').split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        for (let i = 0; i < lines.length; i++) {
            const lineno = i + 1;
            const raw = lines[i]!;
            const stripped = _lstrip(raw);
            if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
                in_fence = !in_fence;
                continue;
            }
            if (in_fence || raw.includes(ALLOW_PRAGMA)) {
                continue;
            }
            // Corrective sentences often wrap, leaving the negation
            // ("never reads", "no project-local lookup") on the previous
            // line and the path on this one. Check both lines for negation
            // so a correctly-negated wrapped mention is not flagged. A real
            // "place it here" instruction never carries a negation one line up.
            const prev = i > 0 ? lines[i - 1]! : '';
            const negated =
                PATH_NEGATION_RE.test(raw) || PATH_NEGATION_RE.test(prev);
            if (PROJECT_PATH_COUNCIL_RE.test(raw) && !negated) {
                findings.push(
                    `${rel}:${lineno}: council config placed in the project tree ` +
                        '— the `.ai-council.yml` file is user-global ONLY ' +
                        '(`~/.event4u/agent-config/settings/.ai-council.yml`, ADR-104). ' +
                        'The project tree is never searched. Point at the user-global ' +
                        'path, add a negation marker, or add ' +
                        `\`${ALLOW_PRAGMA}\` for a historical/superseded reference.`,
                );
            }
        }
    }
    return findings;
}

/** Parse a rule's `workspaces: [a, b, c]` frontmatter line into a set. */
function _workspaces(text: string): Set<string> {
    const m = WORKSPACES_RE.exec(text);
    if (m === null) {
        return new Set<string>();
    }
    return new Set(
        m[1]!
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''))
            .filter((s) => s.length > 0),
    );
}

/**
 * §4 — the user-global fact must have an always-loaded carrier (reach check).
 *
 * A correct resolver, a correct skill, and a green §1–§3 still left consumer
 * sessions claiming "council not configured" — because the fact reached no
 * always-loaded surface. This check fails when no rule under `src/rules/`
 * carries it, and when every carrier that does is scoped more narrowly than
 * the kernel reference (i.e. would not reach the consumer repos that failed).
 */
function find_carrier_violations(root: string): string[] {
    // Scope guard: only a tree that HAS a rule layer can carry the fact. A
    // consumer checkout or a tmp fixture without `src/rules/` is out of scope,
    // exactly as a missing `src/skills/ai-council/` is for §1. The real-repo
    // test asserts this scope is live here, so the skip cannot go unnoticed.
    if (!_isDir(path.join(root, 'src', 'rules'))) {
        return [];
    }
    const rules = [...iter_files(root, [RULES_GLOB])];
    if (rules.length === 0) {
        return [
            `${RULES_GLOB}: \`src/rules/\` exists but resolved to no files — ` +
                'the council user-global fact is unpinned.',
        ];
    }
    const carriers = rules.filter((p) => {
        const text = fs.readFileSync(p, 'utf-8');
        return CARRIER_MARKERS.every((m) => m.re.test(text));
    });
    if (carriers.length === 0) {
        return [
            'src/rules/: no always-loaded rule carries the council user-global ' +
                'fact. One rule must show all of — ' +
                CARRIER_MARKERS.map((m) => m.what).join('; ') +
                '. Without it the fact lives only in ' +
                '`src/skills/ai-council/SKILL.md`, whose body reaches context ' +
                'only on skill activation.',
        ];
    }
    const refPath = path.join(root, REACH_REFERENCE_RULE);
    if (!_isFile(refPath)) {
        return [];
    }
    const refWs = _workspaces(fs.readFileSync(refPath, 'utf-8'));
    if (refWs.size === 0) {
        return [];
    }
    const findings: string[] = [];
    for (const p of carriers) {
        const missing = [...refWs].filter(
            (w) => !_workspaces(fs.readFileSync(p, 'utf-8')).has(w),
        );
        if (missing.length > 0) {
            findings.push(
                `${_relPosix(root, p)}: council carrier is scoped more narrowly ` +
                    `than \`${REACH_REFERENCE_RULE}\` — missing workspace(s): ` +
                    `${missing.join(', ')}. A carrier the consumer never receives ` +
                    'is exactly the gap this check exists to close.',
            );
        }
    }
    // One carrier with full reach is enough; only report when none has it.
    return findings.length === carriers.length ? findings : [];
}

function main(): number {
    const root = process.cwd();
    // PATH_CHECK_GLOBS is the superset of both passes, so its resolution is the
    // whole corpus either check can see. Run from the wrong cwd — or after the
    // council surfaces move — every glob resolves to nothing and the gate
    // reports "clean". Exit 1 is its only failure code.
    try {
        assertScanned({
            gate: 'check_council_config_location',
            scanned: [...iter_files(root, PATH_CHECK_GLOBS)].length,
            units: 'council-surface file(s)',
            roots: PATH_CHECK_GLOBS,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    const findings = [
        ...find_violations(root),
        ...find_path_violations(root),
        ...find_carrier_violations(root),
    ];
    if (findings.length) {
        process.stdout.write('❌  Council config-location violations:\n\n');
        for (const f of findings) {
            process.stdout.write(`  - ${f}\n`);
        }
        process.stdout.write(
            '\nRule: council config lives in the user-global `.ai-council.yml` ' +
                '(`~/.event4u/agent-config/settings/.ai-council.yml`, ADR-104) — ' +
                'never in `.agent-settings.yml`, never in a project `agents/` tree.\n',
        );
        return 1;
    }
    if (!QUIET) {
        process.stdout.write('✅  Council config-location clean.\n');
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

export {
    SCAN_GLOBS,
    PATH_CHECK_GLOBS,
    AGENT_SETTINGS_RE,
    NEGATION_RE,
    AI_COUNCIL_BLOCK_RE,
    PROJECT_PATH_COUNCIL_RE,
    PATH_NEGATION_RE,
    ALLOW_PRAGMA,
    iter_files,
    find_violations,
    find_path_violations,
    find_carrier_violations,
    RULES_GLOB,
    REACH_REFERENCE_RULE,
    CARRIER_MARKERS,
    main,
};
