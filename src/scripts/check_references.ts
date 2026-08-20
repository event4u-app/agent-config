#!/usr/bin/env tsx
/**
 * Cross-reference checker for agent-config repositories.
 *
 * Ported from the retired Python `src/scripts/check_references.py` (ADR-200, Phase 4 /
 * Wave 4a). The CLI contract is pinned — same `--format` /
 * `--root` flags, same exit codes (0 clean, 1 broken refs, 3 internal
 * error), same stdout/stderr split, byte-identical finding messages,
 * same scan scope and order, same example/allowlist/skip logic. No
 * behaviour changes — latent bugs are replicated.
 *
 * Scans .md files in dist/agent-src/ and agents/ for internal references
 * (file paths, skill names, rule names) and reports broken ones.
 *
 * Exit codes: 0 = clean, 1 = broken refs found, 3 = internal error
 *
 * NOTE: the forbidden-substring detector `.agent-src.uncondensed/`
 * appears verbatim in the suggestion / resolution prefixes below — it is
 * port of the retired Python implementation (legacy-path guard auto-exempts
 * faithful twins).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type * as YamlModule from 'yaml';

import { GateLedger, type GateSkipReason } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { assertScanned } from './_lib/scan_scope.js';

/** Where this script lives — used only to re-invoke its own CLI in `--self-test`. */
const REPO_ROOT_FOR_SELF_TEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

type Severity = 'error' | 'warning';

interface BrokenRef {
    file: string;
    line: number;
    ref: string;
    ref_type: string;
    severity: Severity;
    suggestion: string;
}

function makeBrokenRef(
    file: string,
    line: number,
    ref: string,
    ref_type: string,
    severity: Severity,
    suggestion = '',
): BrokenRef {
    return { file, line, ref, ref_type, severity, suggestion };
}

const SCAN_DIRS = ['dist/agent-src', 'agents'];
const SKIP_DIRS = [
    // Archived roadmaps have historical refs — a link to a file that existed when
    // the plan was written is not drift, so the exclusion is right on the merits.
    //
    // ROUND 7, DOWNGRADE (2026-08-12): it also means this checker is the ONLY thing
    // that would see a class of real rot, and cannot. Measured: **530 dead relative
    // links across 147 of 466 archived roadmaps**. The cause is not history — it is
    // that `archive_completed_roadmaps` moves a file one directory deeper and never
    // re-depths its outgoing relative links, so a link that resolved before the move
    // is broken BY the move. Two tools, one silence: the writer does not rewrite, and
    // the only checker that would notice is scoped away from where it lands.
    //
    // Not repaired here: the fix is a bulk edit across 147 files plus a re-depth pass
    // in the sweep, which is its own change. Recorded so the exclusion is read as a
    // known gap with a number rather than as coverage.
    'agents/roadmaps/archive',
    'agents/runtime/council/sessions', // per-user audit trail (gitignored), captured provider output
    'agents/runtime/council/responses', // paired council output (gitignored), captured provider output
    'agents/runtime/council/questions', // design Q&A trail — forward-refs to planned artifacts
    'agents/evidence/analysis', // plate-comparison working docs — forward-refs to planned artifacts
    'agents/evidence/audits', // point-in-time audit write-ups — historical refs to then-current artefacts
    'agents/reports', // transient run reports — historical/scratch refs, not stable artefacts
    'agents/roadmaps/skipped', // skipped roadmaps — abandoned plans w/ forward-refs that never shipped
    'agents/runtime', // volatile / machine-generated artefacts (gitignored)
    'agents/state', // Tier-1 hook runtime state (gitignored, agents-layout § state/) — targets are runtime-created, never in the tree
    'agents/tmp', // user inbox (gitignored) — user-dropped notes/todos; agents only read + move to tmp.old/
    'agents/tmp.old', // processed inbox archive (gitignored) — consumed tmp/ files; janitor TTL 30 days
    'agents/.harvest-local', // deliberate gitignored evidence store (source-confidentiality) — refs to it can never resolve in CI
];

// Per-file opt-out marker. When present in the first 10 lines of a .md
// file, the entire file is skipped. Use for working docs that
// intentionally reference planned-but-not-yet-existing artifacts
// (audit bundles, design Q&A, in-flight plans).
const FILE_SKIP_MARKER = '<!-- check-refs: skip -->';

// Per-line opt-out marker. When present anywhere on a line, that line's
// refs are skipped. Use for isolated forward-refs inside otherwise
// fully-checked documents.
const LINE_IGNORE_MARKER = '<!-- ref-ignore -->';

// YAML memory files (engineering-memory layer) live under `agents/memory/`.
// Each entry may reference skills, ADR paths, or local files via
// `source:` / `enforcement:` / `skill:`. We validate those paths so a
// memory entry cannot rot silently when a file is moved or deleted.
const MEMORY_YAML_ROOT = 'agents/memory';
const MEMORY_FILE_EXTS = [
    '.php',
    '.py',
    '.md',
    '.yml',
    '.yaml',
    '.json',
    '.sh',
    '.js',
    '.ts',
    '.tsx',
    '.jsx',
] as const;
const MEMORY_SKIP_URI_PREFIXES = [
    'http://',
    'https://',
    'adr://',
    'ticket://',
    'incident://',
    'pr://',
] as const;

// File path references like `guidelines/agent-infra/size-and-scope.md`
// Python uses re.finditer (non-overlapping); the JS global flag + lastIndex
// reproduces the same non-overlapping scan.
const PATH_PATTERN =
    /[`"\s](\.?(?:augment|agents|guidelines|rules|skills|commands|contexts|templates|patterns|personas|docs|src)(?:\/[\w._-]+)+\.(?:md|php|py|yml|yaml|json|sh))[`"\s,;)\]]/g;

// Frontmatter `personas:` entries (skills/commands cite personas). Either
// inline list `[a, b]` or YAML block list on subsequent lines.
const FM_PERSONAS_INLINE = /^personas:\s*\[([^\]]*)\]\s*$/;
const FM_PERSONAS_KEY = /^personas:\s*$/;
const FM_LIST_ITEM = /^\s*-\s*([\w-]+)\s*$/;

const SKILL_REF_PATTERN = /`([\w-]+)`\s+skill/g;
const RULE_REF_PATTERN = /`([\w-]+)`\s+rule/g;

// Unchecked TODO items (roadmap checkboxes) legitimately reference files
// and artifacts that do not exist yet. Skip these lines. `[~]` marks
// deferred work — same semantics as `[ ]` for reference resolution
// (forward-looking path, will materialize when the step ships).
const UNCHECKED_TODO_PATTERN = /^\s*[-*+]\s+\[[ ~]\]\s/;
const SKIP_NAMES = new Set<string>([
    'the',
    'a',
    'an',
    'this',
    'that',
    'your',
    'my',
    'no',
    'any',
    'each',
    'one',
    'always',
    'auto',
    'fail',
    'vue',
    'guidelines',
    'naming',
    'orderBy',
    'no-commit',
    'skill-linter',
    'skill-validator',
    'skill-refactor',
    'skill-telegraph-condensation',
    'skill-decondensation',
    'broad_scope',
    'composer',
]);

// Paths that are clearly example/template placeholders (not real references)
const EXAMPLE_PATH_PATTERNS: RegExp[] = [
    /agents\/evidence\/analysis\//, // project-analyze output template
    /agents\/roadmaps\/template/, // template reference
    /agents\/overrides\//, // override examples
    /commands\/old-cmd/, // example placeholder
    /agents\/README/, // README reference (may not exist in package)
    /agents\/index[\w.-]*\.md/, // planned auto-generated artefact index (F5)
    /agents\/reference\/docs\//, // project-specific docs (not in package)
    /agents\/settings\/contexts\//, // project-specific contexts (not in package)
    /agents\/gates/, // project-specific policy docs
    /agents\/features\//, // project-specific feature docs
    /agents\/authentication/, // project-specific auth docs
    /agents\/roadmaps\/agents-/, // dynamically created roadmaps
    /agents\/roadmaps\/test-/, // project-specific roadmaps
    /agents\/ownership-map\.yml/, // consumer-project routing data
    /agents\/historical-bug-patterns\.yml/, // consumer-project routing data
    /agents\/memory\//, // consumer-project memory data
    /agents\/knowledge\//, // consumer-project knowledge cards + typed pages (road-to-knowledge-system)
    /agents\/learnings\//, // consumer-project learning notes
    /agents\/proposals\//, // consumer-project self-improvement proposals
    /agents\/drafts\//, // consumer-project artefact drafts
    /agents\/\.event4u-bridge\.yml/, // consumer-project bridge marker (ADR-020)
    /agents\/\.harvest-local\//, // gitignored harvest-evidence store (source-confidentiality)
    /guidelines\/php-/, // flattened override naming convention
    /rules\/no-commit/, // example rule in commands
    /skills\/[\w-]+\.md/, // short skill refs in examples (not SKILL.md path)
    /skills\/[\w-]+\/SKILL\.md/, // example skill paths in commands
    /\{/, // template placeholders like {module}
    /-foo\.(md|json|yml|yaml)$/, // `-foo.<ext>` placeholder examples
    /-bar\.(md|json|yml|yaml)$/, // `-bar.<ext>` placeholder examples
    // ── docs/+src/ illustrative example paths (Phase-0 step 7a) ──
    // Each entry is a PEDAGOGICAL placeholder inside a skill/template whose
    // stated purpose is demonstrating doc structure — not a real package
    // artefact. (Council rigor: allowlist must cite the skill's intent.)
    /docs\/foo\.md/, // readme-reviewer skill: example doc-path placeholder
    /docs\/decisions\/foo\.md/, // council/default command: example ADR placeholder
    /docs\/auth\.md/, // security skill: sample consumer auth-doc path
    /docs\/billing\.md/, // agents-md-anatomy context: sample consumer doc path
    /docs\/runbooks\//, // observability template: sample consumer runbook paths
    /docs\/adr\/00/, // challenge-me-with-docs + architecture-decisions example: sample ADR refs (package uses docs/decisions/ADR-NNN)
    /src\/scripts\/X\.py/, // step-execution report: `X.py` literal placeholder
    // ── docs/ forward-looking artefacts (planned, will materialise) ──
    /docs\/contracts\/domain-pack-overlap-inventory\.md/, // domain-pack-extraction roadmap: planned contract
    // Forward references inside in-flight planning docs (road-to-
    // structural-optimization.md and its companion spike protocols).
    // Each pattern below is removed once the matching phase lands.
    /structural-optimization-3a-spike\.md/, // 3a.0.2
    /contexts\/judges\/no-consolidate-rationale/, // 3a.0.2 abort
    /contexts\/judges\/judge-shared-procedure/, // 3a.1
    /contexts\/analysis\/project-analysis-core-procedure/, // 3b.1
    /agents\/roadmaps\/phase6-non-overlap-evidence/, // 6.1 conditional
];

interface AllowlistPattern {
    /** A token-class allowlist entry. `reason` is mandatory and auditable. */
    readonly pattern: RegExp;
    readonly reason: string;
}

// Content-class allowlist for known NON-reference token shapes.
//
// The skill/rule prose patterns (`X` skill / `X` rule) occasionally match
// a backtick token that is not an artifact id — an execution-type enum
// value, a pack identifier, or a bare meta-qualifier keyword. Historically
// each such false positive was dodged by *rewording the prose per file*
// (e.g. dc84ed01 "reword execution-type mentions to dodge check-refs
// false positive", bd02ef0b "avoid check-refs false-positive on pack
// name"), a treadmill that distorts natural wording release after release.
// This layer matches the token *class* centrally instead, so the natural
// wording passes without per-file edits. It is distinct from:
//   - SKIP_DIRS          (path-level, whole-directory)
//   - FILE_SKIP_MARKER   (file-level opt-out)
//   - LINE_IGNORE_MARKER (per-line opt-out)
// Every entry carries a mandatory `reason` so the allowlist stays
// auditable and a future reader can tell why a class is exempt.
const ALLOWLIST_PATTERNS: AllowlistPattern[] = [
    {
        pattern: /^(?:manual|assisted|automated)$/,
        reason:
            'execution-type enum value (runtime-safety frontmatter), e.g. a ' +
            '`manual` skill — not a skill/rule id (dc84ed01)',
    },
    {
        pattern: /^pack-[\w-]+$/,
        reason:
            'pack / workspace identifier, e.g. `pack-ai-video` skills — not a ' +
            'skill/rule id (bd02ef0b)',
    },
    {
        pattern: /^(?:skill|rule|command|guideline|persona|context|pack|workspace)$/,
        reason:
            'bare meta-qualifier keyword used in prose (the `command` vs ' +
            '`skill` distinction, etc.) — not an artifact id',
    },
];

function _is_allowlisted(name: string): boolean {
    // True when `name` matches a known non-reference token class.
    return ALLOWLIST_PATTERNS.some((entry) => entry.pattern.test(name));
}

type Artifacts = {
    skills: Set<string>;
    rules: Set<string>;
    commands: Set<string>;
    guidelines: Set<string>;
    personas: Set<string>;
};

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

/** Recursively list files matching a suffix under `dir`, mirroring Path.rglob. */
function _rglob(dir: string, suffix: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith(suffix)) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

/** Recursively list files with any of the given extension matchers (rglob of `name`). */
function _rglobName(dir: string, fileName: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name === fileName) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

function collect_artifacts(root: string): Artifacts {
    // Build lookup sets for skills, rules, commands, guidelines, personas.
    const arts: Artifacts = {
        skills: new Set<string>(),
        rules: new Set<string>(),
        commands: new Set<string>(),
        guidelines: new Set<string>(),
        personas: new Set<string>(),
    };
    const augment = path.join(root, 'dist/agent-src');
    if (!_exists(augment)) {
        return arts;
    }
    const skillsDir = path.join(augment, 'skills');
    if (_exists(skillsDir)) {
        for (const name of fs.readdirSync(skillsDir)) {
            const d = path.join(skillsDir, name);
            if (_isDir(d) && _exists(path.join(d, 'SKILL.md'))) {
                arts.skills.add(name);
            }
        }
    }
    const rulesDir = path.join(augment, 'rules');
    if (_exists(rulesDir)) {
        for (const f of fs.readdirSync(rulesDir)) {
            if (f.endsWith('.md') && _isFile(path.join(rulesDir, f))) {
                arts.rules.add(f.slice(0, -'.md'.length));
            }
        }
    }
    const cmdDir = path.join(augment, 'commands');
    if (_exists(cmdDir)) {
        for (const full of _rglob(cmdDir, '.md')) {
            if (path.basename(full) === 'AGENTS.md') {
                continue;
            }
            // Top-level: bare stem ("commit"). Nested: cluster-sub ("council-default")
            // AND the cluster:sub form, since references may use either.
            const rel = path.relative(cmdDir, full).replace(/\.md$/, '');
            const parts = rel.split(path.sep);
            if (parts.length === 1) {
                arts.commands.add(parts[0]!);
            } else {
                arts.commands.add(parts.join('-'));
                arts.commands.add(parts.join(':'));
            }
        }
    }
    const gdir = path.join(augment, 'guidelines');
    if (_exists(gdir)) {
        for (const full of _rglob(gdir, '.md')) {
            arts.guidelines.add(_relPosix(augment, full));
        }
    }
    const pdir = path.join(augment, 'personas');
    if (_exists(pdir)) {
        for (const f of fs.readdirSync(pdir)) {
            if (f.endsWith('.md') && _isFile(path.join(pdir, f))) {
                const stem = f.slice(0, -'.md'.length);
                if (stem !== 'README') {
                    arts.personas.add(stem);
                }
            }
        }
    }
    return arts;
}

/** POSIX-style relative path (Path.relative_to(...).as_posix() / str()). */
function _relPosix(base: string, target: string): string {
    return path.relative(base, target).split(path.sep).join('/');
}

function _extract_personas_frontmatter(text: string): Array<[number, string]> {
    // Parse frontmatter for `personas:` list entries. Returns (line_no, id).
    if (!text.startsWith('---')) {
        return [];
    }
    const end = text.indexOf('\n---', 3);
    if (end < 0) {
        return [];
    }
    const fmLines = text.slice(3, end).split('\n');
    const results: Array<[number, string]> = [];
    let i = 0;
    // Frontmatter starts at file line 2 (after opening `---` on line 1).
    while (i < fmLines.length) {
        const line = fmLines[i]!;
        const lineNo = i + 2;
        const mInline = FM_PERSONAS_INLINE.exec(line);
        if (mInline) {
            const inner = mInline[1]!;
            for (const raw of inner.split(',')) {
                const v = raw.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
                if (v) {
                    results.push([lineNo, v]);
                }
            }
            i += 1;
            continue;
        }
        if (FM_PERSONAS_KEY.test(line)) {
            let j = i + 1;
            while (j < fmLines.length) {
                const itemM = FM_LIST_ITEM.exec(fmLines[j]!);
                if (!itemM) {
                    break;
                }
                results.push([j + 2, itemM[1]!]);
                j += 1;
            }
            i = j;
            continue;
        }
        i += 1;
    }
    return results;
}

/**
 * Paths this checker must not call broken because nothing is allowed to fix them.
 *
 * `archive_completed_roadmaps` treats `agents/evidence/**` and every `*.patch` as
 * a FROZEN RECORD and deliberately does not rewrite path strings there — a review
 * artefact is a record of what a reviewer was shown, and editing it retroactively
 * makes it claim something that did not happen (measured 2026-08-11: one archival
 * rewrote four frozen artefacts including a `diff.patch` header, and reported it
 * as "4 ref(s) migrated"). So when a roadmap is archived, a record naming its old
 * path keeps naming it — correctly.
 *
 * Without this carve-out the two gates contradict each other: the sweep forbids
 * the rewrite and this checker reds the un-rewritten path, so EVERY archival of a
 * roadmap a review artefact mentions turns CI red with no compliant fix available.
 * Measured on the change that made archival automatic: 2 such references.
 *
 * Deliberately narrow — three conditions, all required. The source is a frozen
 * record; the reference is a top-level roadmap path; and the file is still
 * findable under a terminal disposition. A frozen record pointing at a roadmap
 * that exists NOWHERE is still broken and still reds, which is the part a blanket
 * `agents/evidence/reviews` exclusion would have lost: that directory holds live
 * `*.findings.md` work alongside archived records, so excluding it wholesale would
 * stop checking documents that are still being acted on.
 *
 * The frozen-record predicate is duplicated from `_is_frozen_record` in
 * `src/agent-src/scripts/archive_completed_roadmaps.ts` rather than imported: that
 * module is projected into consumer installs and pulls the dashboard generator in
 * with it, so a package-internal gate importing it would drag the projection layer
 * into CI's gate path. `tests/scripts/check_references.test.ts` holds the two
 * copies against one table so the duplication cannot drift silently.
 */
const _FROZEN_RECORD_PREFIXES = ['agents/evidence/'];
const _TERMINAL_ROADMAP_DIRS = ['archive', 'skipped', 'later'];

export function _is_frozen_record_source(rel: string): boolean {
    const norm = rel.split(path.sep).join('/');
    return _FROZEN_RECORD_PREFIXES.some((p) => norm.startsWith(p)) || norm.endsWith('.patch');
}

/** Does `ref` name a top-level roadmap that now lives under a terminal disposition? */
export function _resolves_under_terminal_disposition(ref: string, root: string): boolean {
    const norm = ref.split(path.sep).join('/');
    const m = /^agents\/roadmaps\/([^/]+\.md)$/.exec(norm);
    if (m === null) {
        return false;
    }
    return _TERMINAL_ROADMAP_DIRS.some((d) =>
        _exists(path.join(root, 'agents', 'roadmaps', d, m[1] as string)),
    );
}

function _find_suggestion(p: string, root: string): string {
    const name = path.basename(p);
    // DEAD-ROOT REPAIR (road-to-renewal-foundation Phase 1): the middle entry
    // was `.agent-src.uncondensed`, deleted by ADR-051. `src/` is the source of
    // truth, so a file that exists only there produced no suggestion at all.
    for (const d of [
        path.join(root, 'dist/agent-src'),
        path.join(root, 'src'),
        path.join(root, 'agents'),
    ]) {
        if (_exists(d)) {
            const matches = _rglobName(d, name);
            for (const f of matches) {
                return _relPosix(root, f);
            }
        }
    }
    return '';
}

function _closest_match(name: string, candidates: Set<string>): string {
    for (const c of [...candidates].sort()) {
        if (c.includes(name) || name.includes(c)) {
            return c;
        }
    }
    return '';
}

function check_file(
    filepath: string,
    artifacts: Artifacts,
    root: string,
    /**
     * Called instead of checking, when the file is not judged at all. Both
     * early returns below used to return an empty `broken[]`, which is
     * byte-identical to "checked and clean" for every caller — so an
     * opted-out file counted as coverage. The sink lets the ledger tell the
     * two apart without changing this function's return type.
     */
    onSkip?: (reason: GateSkipReason) => void,
): BrokenRef[] {
    // Check a single .md file for broken references.
    const broken: BrokenRef[] = [];
    let text: string;
    try {
        text = fs.readFileSync(filepath, 'utf-8');
    } catch {
        onSkip?.('binary_content');
        return broken;
    }

    // File-level opt-out: working docs that intentionally reference
    // planned-but-not-yet-existing artifacts mark themselves with
    // `<!-- check-refs: skip -->` in the first 10 lines. Marker pairs
    // with the per-line `<!-- ref-ignore -->` below; either suffices.
    const headerLines = text.split('\n').slice(0, 10);
    if (headerLines.some((line) => line.includes(FILE_SKIP_MARKER))) {
        onSkip?.('declared_exemption');
        return broken;
    }

    // Validate `personas:` frontmatter entries against known persona ids.
    for (const [lineNo, pid] of _extract_personas_frontmatter(text)) {
        if (!artifacts.personas.has(pid)) {
            broken.push(
                makeBrokenRef(
                    filepath,
                    lineNo,
                    pid,
                    'persona',
                    'error',
                    _closest_match(pid, artifacts.personas),
                ),
            );
        }
    }

    let inCodeBlock = false;
    // Track whether we are inside an unchecked-TODO bullet (multi-line
    // roadmap items wrap continuation text under the `- [ ]` line and
    // those continuation lines must inherit the forward-ref exemption).
    let inUncheckedTodo = false;
    const lines = text.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
        const i = idx + 1;
        const line = lines[idx]!;
        const stripped = line.trim();
        if (stripped.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) {
            continue;
        }

        // Per-line opt-out: isolated forward-refs in otherwise checked
        // documents (e.g. one ref to a planned skill, surrounded by
        // valid refs). Skip the whole line's path / skill / rule checks.
        if (line.includes(LINE_IGNORE_MARKER)) {
            continue;
        }

        // Unchecked TODO checkboxes document future work — their refs are
        // forward-looking and will not resolve yet. Track multi-line bullets:
        // any `- [ ]` opens a TODO context; a new top-level bullet, heading,
        // or blank line closes it.
        if (UNCHECKED_TODO_PATTERN.test(line)) {
            inUncheckedTodo = true;
            continue;
        }
        if (inUncheckedTodo) {
            if (!stripped) {
                inUncheckedTodo = false;
                continue;
            }
            // A new bullet (checked or unchecked) or a heading closes the
            // current TODO context. An indented continuation line keeps it.
            if (/^[-*+]\s+\[/.test(line) || stripped.startsWith('#')) {
                inUncheckedTodo = false;
            } else if (line[0] === ' ' || line[0] === '\t') {
                // Indented continuation of the unchecked TODO — skip.
                continue;
            } else {
                inUncheckedTodo = false;
            }
        }

        // File path references
        PATH_PATTERN.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = PATH_PATTERN.exec(line)) !== null) {
            const rawRef = m[1]!;

            // Skip known example/template paths
            if (EXAMPLE_PATH_PATTERNS.some((p) => p.test(rawRef))) {
                continue;
            }

            // Skip references into directories already excluded from scanning
            // (gitignored audit trails, archived roadmaps). Files there are
            // not committed, so existence checks would always fail in CI.
            if (SKIP_DIRS.some((skip) => rawRef.startsWith(skip + '/') || rawRef === skip)) {
                continue;
            }

            let resolved = false;
            // Try raw ref as-is from root (covers dist/agent-src/..., agents/..., etc.)
            if (_exists(path.join(root, rawRef))) {
                resolved = true;
            } else {
                // Strip leading ./ and try with prefixes
                const ref = rawRef.replace(/^[./]+/, '');
                // DEAD-ROOT REPAIR: `.agent-src.uncondensed` (ADR-051) never
                // resolved, so a reference that only exists under the source of
                // truth was reported BROKEN. `src/` and its category roots
                // replace it.
                for (const prefix of [
                    root,
                    path.join(root, 'dist/agent-src'),
                    path.join(root, 'src'),
                    path.join(root, 'src/agent-src'),
                ]) {
                    if (_exists(path.join(prefix, ref))) {
                        resolved = true;
                        break;
                    }
                }
                // `.augment/` is a local projection of `dist/agent-src/` (gitignored).
                // In CI the projection doesn't exist, so resolve `.augment/X`
                // against the canonical source at `dist/agent-src/X` (and the
                // uncondensed authoring tree as a fallback). Note: `raw_ref`
                // keeps the leading dot; `ref` above was stripped via lstrip.
                if (!resolved && rawRef.startsWith('.augment/')) {
                    const rel = rawRef.slice('.augment/'.length);
                    for (const prefix of [
                        path.join(root, 'dist/agent-src'),
                        path.join(root, 'src/agent-src'),
                    ]) {
                        if (_exists(path.join(prefix, rel))) {
                            resolved = true;
                            break;
                        }
                    }
                }
                // `agents/runtime/state/*.json` are runtime hook state files
                // under the gitignored runtime tree. `agents/runtime/.agent-prices.md`
                // is the runtime-bootstrapped pricing cache. The SKIP_DIRS
                // check above already swallows refs into `agents/runtime/`,
                // so no extra carve-out is needed.
            }
            if (
                !resolved &&
                _is_frozen_record_source(_relPosix(root, filepath)) &&
                _resolves_under_terminal_disposition(rawRef, root)
            ) {
                // A record naming the pre-archival path of a roadmap that is
                // still findable. Nothing may rewrite it — see above.
                resolved = true;
            }
            if (!resolved) {
                broken.push(
                    makeBrokenRef(
                        filepath,
                        i,
                        m[1]!,
                        'path',
                        'error',
                        _find_suggestion(rawRef, root),
                    ),
                );
            }
        }

        // Skill name references
        SKILL_REF_PATTERN.lastIndex = 0;
        while ((m = SKILL_REF_PATTERN.exec(line)) !== null) {
            const name = m[1]!;
            if (!artifacts.skills.has(name) && !SKIP_NAMES.has(name) && !_is_allowlisted(name)) {
                broken.push(
                    makeBrokenRef(
                        filepath,
                        i,
                        name,
                        'skill',
                        'warning',
                        _closest_match(name, artifacts.skills),
                    ),
                );
            }
        }

        // Rule name references
        RULE_REF_PATTERN.lastIndex = 0;
        while ((m = RULE_REF_PATTERN.exec(line)) !== null) {
            const name = m[1]!;
            if (!artifacts.rules.has(name) && !SKIP_NAMES.has(name) && !_is_allowlisted(name)) {
                broken.push(
                    makeBrokenRef(
                        filepath,
                        i,
                        name,
                        'rule',
                        'warning',
                        _closest_match(name, artifacts.rules),
                    ),
                );
            }
        }
    }

    return broken;
}

function _looks_like_local_path(value: unknown): boolean {
    // Heuristic: treat as a path if it has a known extension and no URI scheme.
    if (typeof value !== 'string' || !value.trim()) {
        return false;
    }
    const v = value.trim();
    if (MEMORY_SKIP_URI_PREFIXES.some((p) => v.startsWith(p))) {
        return false;
    }
    // Globs and wildcard patterns can't be resolved as files
    if (v.includes('*') || v.includes('?') || v.includes('[')) {
        return false;
    }
    // Must contain a directory separator AND end with a known extension
    if (!v.includes('/')) {
        return false;
    }
    const lower = v.toLowerCase();
    return MEMORY_FILE_EXTS.some((ext) => lower.endsWith(ext));
}

function _walk_yaml(data: unknown, paths: string[], skills: string[]): void {
    // Recursively collect path-like strings and `skill:` values.
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
            if ((k === 'skill' || k === 'skills') && typeof v === 'string') {
                skills.push(v);
            } else if ((k === 'skill' || k === 'skills') && Array.isArray(v)) {
                for (const x of v) {
                    if (typeof x === 'string') {
                        skills.push(x);
                    }
                }
            } else {
                _walk_yaml(v, paths, skills);
            }
        }
    } else if (Array.isArray(data)) {
        for (const item of data) {
            _walk_yaml(item, paths, skills);
        }
    } else if (typeof data === 'string') {
        if (_looks_like_local_path(data)) {
            paths.push(data);
        }
    }
}

function check_memory_yaml(filepath: string, artifacts: Artifacts, root: string): BrokenRef[] {
    // Validate path/skill refs inside an engineering-memory YAML file.
    const broken: BrokenRef[] = [];
    let YAML: typeof YamlModule;
    try {
        // Lazy require mirrors Python's optional `import yaml` — a missing
        // package degrades to no findings (text-ref checker still runs).
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        YAML = require('yaml') as typeof YamlModule;
    } catch {
        return broken; // PyYAML optional; text-ref checker still runs
    }
    let data: unknown;
    try {
        const text = fs.readFileSync(filepath, 'utf-8');
        // version '1.1' matches PyYAML safe_load semantics.
        data = YAML.parse(text, { version: '1.1' });
    } catch {
        return broken;
    }
    if (!data) {
        return broken;
    }
    const paths: string[] = [];
    const skills: string[] = [];
    _walk_yaml(data, paths, skills);
    for (const p of paths) {
        if (!_exists(path.join(root, p.replace(/^[./]+/, '')))) {
            broken.push(
                makeBrokenRef(filepath, 0, p, 'memory-path', 'error', _find_suggestion(p, root)),
            );
        }
    }
    for (const s of skills) {
        if (!artifacts.skills.has(s) && !SKIP_NAMES.has(s)) {
            broken.push(
                makeBrokenRef(
                    filepath,
                    0,
                    s,
                    'memory-skill',
                    'warning',
                    _closest_match(s, artifacts.skills),
                ),
            );
        }
    }
    return broken;
}

function scan_all(root: string): BrokenRef[] {
    const artifacts = collect_artifacts(root);
    const broken: BrokenRef[] = [];
    // Completeness accounting. The two hidden outcomes this makes visible:
    // a missing scan root (`continue` on a dead directory, previously silent
    // and uncounted — the canonical false green), and a file that opted out of
    // the check but was still counted as coverage.
    const ledger = new GateLedger('check_references');
    for (const scanDir of SCAN_DIRS) {
        const d = path.join(root, scanDir);
        if (!_exists(d)) {
            ledger.plan(scanDir);
            ledger.skip(scanDir, 'dead_scan_root');
            continue;
        }
        const files = _rglob(d, '.md').sort();
        ledger.plan(files.map((f) => _relPosix(root, f)));
        for (const f of files) {
            const rel = _relPosix(root, f);
            // Skip archived directories
            if (SKIP_DIRS.some((skip) => f.startsWith(path.join(root, skip)))) {
                ledger.outOfScope(rel, 'excluded_directory');
                continue;
            }
            let skipped = false;
            const found = check_file(f, artifacts, root, (reason) => {
                skipped = true;
                ledger.skip(rel, reason);
            });
            if (!skipped) {
                if (found.length > 0) {
                    ledger.fail(rel, `${String(found.length)} broken reference(s)`);
                } else {
                    ledger.complete(rel);
                }
            }
            broken.push(...found);
        }
    }
    const memoryDir = path.join(root, MEMORY_YAML_ROOT);
    if (_isDir(memoryDir)) {
        const yamls = [..._rglob(memoryDir, '.yml').sort(), ..._rglob(memoryDir, '.yaml').sort()];
        ledger.plan(yamls.map((f) => _relPosix(root, f)));
        for (const f of yamls) {
            const rel = _relPosix(root, f);
            const found = check_memory_yaml(f, artifacts, root);
            if (found.length > 0) {
                ledger.fail(rel, `${String(found.length)} broken reference(s)`);
            } else {
                ledger.complete(rel);
            }
            broken.push(...found);
        }
    }
    // gate-coverage contract (src/config/gate-coverage.yml): a machine-readable
    // count of files actually JUDGED, so `check_gate_coverage` can assert this
    // gate saw a real corpus rather than a moved root. It is the ledger's own
    // completed+failed, so the published number cannot drift from the number
    // the accounting accepted.
    const tally = ledger.report();
    // Fail closed on a fully dead scope. Both scan roots absent used to print
    // `scanned: 0` and then `✅ No broken references found.` — the canonical
    // false green, and the one shape this gate had no guard against.
    assertScanned({
        gate: 'check_references',
        scanned: tally.completed + tally.failed,
        units: 'file(s)',
        roots: SCAN_DIRS,
    });
    process.stderr.write(`scanned: ${String(tally.completed + tally.failed)}\n`);
    return broken;
}

/**
 * Mirror Python `json.dumps(obj, indent=2)` byte-for-byte, including the
 * default `ensure_ascii=True` non-ASCII escaping. `JSON.stringify` with a
 * 2-space indent already matches the separators (`,` item / `: ` key); the
 * only delta is that JS emits raw UTF-8 while Python escapes any codepoint
 * ≥ 0x80 as `\uXXXX` (surrogate pairs for astral planes). We post-process
 * the JS output to add that escaping.
 */
function _json_dumps_ascii(obj: unknown): string {
    const raw = JSON.stringify(obj, null, 2);
    let out = '';
    for (const ch of raw) {
        const code = ch.codePointAt(0)!;
        if (code < 0x80) {
            out += ch;
        } else {
            // JS string iteration yields full code points; for astral chars
            // emit the surrogate pair, matching Python's \uXXXX\uXXXX form.
            for (let k = 0; k < ch.length; k++) {
                out += '\\u' + ch.charCodeAt(k).toString(16).padStart(4, '0');
            }
        }
    }
    return out;
}

function format_text(broken: BrokenRef[]): string {
    if (broken.length === 0) {
        return '✅  No broken references found.';
    }
    const lines: string[] = [`❌  Found ${broken.length} broken reference(s):\n`];
    for (const b of broken) {
        const icon = b.severity === 'error' ? '🔴' : '🟡';
        let line = `  ${icon} ${b.file}:${b.line} — ${b.ref_type} \`${b.ref}\``;
        if (b.suggestion) {
            line += ` → did you mean \`${b.suggestion}\`?`;
        }
        lines.push(line);
    }
    return lines.join('\n');
}

interface ParsedArgs {
    format: 'text' | 'json';
    root: string;
}

/**
 * Minimal argparse-compatible flag parsing. Mirrors the Python
 * `--format {text,json}` / `--root PATH` contract, including the
 * argparse error surface (exit 2 on a bad choice / unknown flag).
 */
function parse_args(argv: readonly string[]): ParsedArgs {
    let format: 'text' | 'json' = 'text';
    let root = '.';
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--format') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --format: expected one argument');
            }
            if (v !== 'text' && v !== 'json') {
                _argparse_error(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json')`,
                );
            }
            format = v;
        } else if (arg.startsWith('--format=')) {
            const v = arg.slice('--format='.length);
            if (v !== 'text' && v !== 'json') {
                _argparse_error(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json')`,
                );
            }
            format = v;
        } else if (arg === '--root') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --root: expected one argument');
            }
            root = v;
        } else if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_references [-h] [--format {text,json}] [--root ROOT]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { format, root };
}

function _argparse_error(message: string): never {
    process.stderr.write(`check_references: error: ${message}\n`);
    process.exit(2);
}

/**
 * Prove, against the real CLI, that this gate still rejects what it must.
 *
 * The dead-scope case is the one that matters: until this change, both scan
 * roots absent produced `scanned: 0` followed by "No broken references found"
 * and exit 0.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'refs-selftest-'));
    const seed = (root: string, body: string | null): string => {
        const dir = path.join(tmp, root, 'dist', 'agent-src', 'rules');
        fs.mkdirSync(dir, { recursive: true });
        if (body !== null) {
            fs.writeFileSync(path.join(dir, 'demo.md'), body, 'utf-8');
        }
        return path.join(tmp, root);
    };
    const run = (root: string): number =>
        runGateCli(REPO_ROOT_FOR_SELF_TEST, 'src/scripts/check_references.ts', ['--root', root], REPO_ROOT_FOR_SELF_TEST);

    try {
        return runSelfTest({
            gate: 'check_references',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                {
                    name: 'a broken file reference is rejected',
                    expect: 'reject',
                    run: () =>
                        run(seed('broken', '# Demo\n\nSee `docs/guidelines/definitely-not-here.md` for detail.\n')),
                },
                {
                    name: 'a document with no references passes',
                    expect: 'accept',
                    run: () => run(seed('clean', '# Demo\n\nNothing to resolve here.\n')),
                },
                {
                    name: 'an EMPTY corpus is rejected — a gate that read nothing has not passed',
                    expect: 'reject',
                    run: () => run(seed('empty', null)),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function main(): number {
    if (process.argv.slice(2).includes('--self-test')) {
        return selfTest();
    }
    const args = parse_args(process.argv.slice(2));

    let broken: BrokenRef[];
    try {
        broken = scan_all(args.root);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Internal error: ${msg}\n`);
        return 3;
    }

    if (args.format === 'json') {
        process.stdout.write(_json_dumps_ascii(broken) + '\n');
    } else {
        process.stdout.write(format_text(broken) + '\n');
    }

    return broken.length ? 1 : 0;
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
    type BrokenRef,
    type Severity,
    type Artifacts,
    SCAN_DIRS,
    SKIP_DIRS,
    FILE_SKIP_MARKER,
    LINE_IGNORE_MARKER,
    MEMORY_YAML_ROOT,
    MEMORY_FILE_EXTS,
    MEMORY_SKIP_URI_PREFIXES,
    PATH_PATTERN,
    SKILL_REF_PATTERN,
    RULE_REF_PATTERN,
    UNCHECKED_TODO_PATTERN,
    SKIP_NAMES,
    EXAMPLE_PATH_PATTERNS,
    ALLOWLIST_PATTERNS,
    type AllowlistPattern,
    _is_allowlisted,
    collect_artifacts,
    _extract_personas_frontmatter,
    _find_suggestion,
    _closest_match,
    check_file,
    _looks_like_local_path,
    _walk_yaml,
    check_memory_yaml,
    scan_all,
    format_text,
    main,
};
