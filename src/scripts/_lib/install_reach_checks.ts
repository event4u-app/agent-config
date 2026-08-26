/**
 * Install-reach checks for `agent-config doctor`.
 *
 * `road-to-consumer-repo-reality` Phase 1. The existing doctor family answers
 * "is the mechanism I configured working" — hooks resolve, the router parses,
 * the settings cascade returns something, the manifest matches the filesystem.
 * **None of them asks whether a path a root INSTRUCTION FILE names resolves at
 * all**, which is the one question this module adds.
 *
 * The distinction is not academic. `doctor`'s existing `missing` drift category
 * compares MANIFEST entries against disk: it knows what the installer claims it
 * wrote. A root instruction file is a different kind of claim — prose, written
 * by a human or a previous install, describing an agent layer to the model that
 * reads it. When that prose over-reports, every routing decision downstream is
 * made against a layer that is not there and nothing surfaces the fault.
 *
 * THREE OUTCOMES, NEVER TWO. Risk-register rank 4 of the roadmap: "a checker
 * that parses instruction files can misparse a path and report a healthy
 * install as broken, which is worse than not checking". So a path is `present`,
 * `dangling`, or `unresolvable` — and an `unresolvable` path is attributed to
 * THIS CHECKER in its own message, never reported as absent.
 *
 * ALL THREE ARE REPORTS. `doctor` writes nothing and always exits zero on a
 * clean tree; a check here returns a verdict and never a refusal. A gate that
 * wanted to refuse would belong in the gate estate.
 *
 * Extracted into `_lib/` rather than added to `cmd_doctor.ts` for the reason
 * `runtime_wiring_checks.ts` states for itself: that file is ~3,700 lines and
 * `check_source_size_budget` counts every line above 1,500, so checks written
 * inline are charged against a budget while the same code in a new module is
 * free. The seam is also what makes them unit-testable without booting the CLI.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { WiringCheck } from './runtime_wiring_checks.js';

/**
 * Root agent-instruction files, as a multi-vendor ecosystem convention rather
 * than this package's own arrangement — which is the roadmap's Phase 1 anchor.
 * `AGENTS.md` is the cross-vendor one; the rest are per-tool root files.
 *
 * Order is stable so a report is diffable. A consumer carrying none of them is
 * not a fault: it is a tree with no root instruction surface, and the check
 * reports `skipped` rather than inventing a finding.
 */
export const ROOT_INSTRUCTION_FILES: readonly string[] = [
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md',
];

/**
 * Deliberately NOT read: `.windsurfrules`, `.cursorrules`, `.clinerules`.
 *
 * They are single-file CONCATENATIONS of many rule bodies rather than authored
 * root documents, and that difference decides whether their paths are claims at
 * all. A path inside a concatenated body is relative to the rule's ORIGINAL
 * location, not to the repository root, so resolving it from the root is a
 * category error. Many are not even claims: a rule that enumerates the four
 * candidate locations a resolver searches (`assets/tokens.json`,
 * `resources/tokens.json`, …) is listing possibilities, and at most one exists
 * by design.
 *
 * Measured on this repository before the exclusion: `.windsurfrules` produced 49
 * of 57 "dangling" paths, every one a false positive, while the four authored
 * files above produced 8 — all real. Since these three are ALSO this package's
 * own generated projections, shipped into consumer trees, reading them would
 * have made `doctor` fail for every consumer that installs them.
 *
 * Risk-register rank 4, in its sharpest form: a checker that reports a healthy
 * install as broken is worse than not checking.
 */
export const EXCLUDED_CONCATENATIONS: readonly string[] = ['.windsurfrules', '.cursorrules', '.clinerules'];

/** One path a root instruction file named, and what resolving it found. */
export interface NamedPath {
    /** The instruction file the path was read from, repo-relative. */
    source: string;
    /** The path as written in that file. */
    raw: string;
    /** `raw` normalised for filesystem resolution, or null when unresolvable. */
    normalised: string | null;
    outcome: 'present' | 'dangling' | 'unresolvable';
    /** Why the parser could not interpret it. Set only for `unresolvable`. */
    reason?: string;
}

/**
 * Paths this checker deliberately does NOT claim to resolve, with the reason
 * stated per class rather than lumped into one bucket. Each is reported as
 * `unresolvable` with its reason, which is the honest answer: the checker
 * cannot tell whether an absolute path or a URL exists in the consumer's world.
 */
const UNRESOLVABLE_REASONS: readonly { test: (s: string) => boolean; reason: string }[] = [
    { test: (s) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s), reason: 'a URL, not a repository path' },
    { test: (s) => s.startsWith('/'), reason: 'absolute — outside the repository root this checker resolves against' },
    { test: (s) => s.startsWith('~'), reason: 'home-relative — resolves per machine, not per repository' },
    { test: (s) => s.includes('*') || s.includes('?') || s.includes('['), reason: 'a glob, which names a set rather than a path' },
    { test: (s) => s.includes('<') || s.includes('>') || s.includes('{'), reason: 'carries a placeholder, so no single path is named' },
    { test: (s) => s.startsWith('..'), reason: 'escapes the repository root' },
    {
        // `archive/`, `skipped/` — written inside prose that already established
        // a parent directory. Read from the repository root they are wrong, and
        // reporting them dangling would blame the tree for the checker's missing
        // context. Their parent is knowable to a reader and not to this parser.
        test: (s) => /^[^/]+\/$/.test(s),
        reason: 'a bare directory reference — the prose around it names the parent, this parser does not',
    },
];

/**
 * A repo-relative path as written in markdown prose or a link target.
 *
 * Deliberately conservative. It matches a path only when it carries a directory
 * separator or a known agent-layer directory name, because a bare word in prose
 * is not a path and treating it as one is exactly the false-positive rank 4
 * warns about. Backtick-quoted spans and markdown link targets are the two
 * shapes that actually carry paths in these files.
 */
const BACKTICKED = /`([^`\n]+)`/g;
const LINK_TARGET = /\]\(([^)\s]+)\)/g;

/**
 * A path claim must be ANCHORED. This is the single most load-bearing decision
 * in the module, and it is the answer to risk-register rank 4: a checker that
 * reports a healthy install as broken is worse than not checking.
 *
 * A first attempt treated a bare agent-layer word (`skills`, `rules`) as a path
 * claim and any token containing a slash as a path. Measured against this
 * repository's own root files, that produced **38 "dangling" paths, and the
 * majority were not paths at all**: `skills` in prose means "the skills layer",
 * not `./skills`, and `event4u/agent-config` is a package name that happens to
 * contain a slash. Both would have been reported as a broken install.
 *
 * Anchored means one of: it starts with `./`, `../`, `/` or `.`; it ends with
 * `/`; it carries a file extension; or its FIRST SEGMENT is a directory that
 * exists in the tree. The last clause is what separates `src/skills` (the
 * segment `src` is there, so a claim about `src/skills` is a claim about this
 * tree) from `event4u/agent-config` (no `event4u` directory, so the token reads
 * as a name). It deliberately does NOT require the whole path to exist — a
 * wholly absent layer under an existing parent, which is the defect this check
 * is for, stays anchored and is reported dangling.
 */
const EXTENSION = /\.[A-Za-z0-9]{1,8}$/;

function _isAnchored(projectRoot: string, token: string): boolean {
    if (token.startsWith('./') || token.startsWith('../') || token.startsWith('/') || token.startsWith('.')) return true;
    if (token.endsWith('/')) return true;
    if (EXTENSION.test(token)) return true;
    const first = token.split('/')[0];
    if (first === undefined || first === '' || first === token) return false;
    try {
        return fs.statSync(path.join(projectRoot, first)).isDirectory();
    } catch {
        return false;
    }
}

function _looksLikePath(projectRoot: string, token: string): boolean {
    const t = token.trim();
    if (t === '') return false;
    // A shell command, a flag, or prose with spaces is not a path claim.
    if (/\s/.test(t)) return false;
    if (t.startsWith('-')) return false;
    // A token with NO separator is a filename or an identifier, never a
    // repository-relative path — `link_crypto.ts`, `size-enforcement.md` and
    // `pathlib.Path` all reached this function during development and all three
    // would have been reported dangling. A bare name states no location, so
    // there is nothing to resolve and nothing to report.
    if (!t.includes('/')) return false;
    return _isAnchored(projectRoot, t);
}

/** Extract every path-shaped token from one instruction file's text. */
export function extractNamedPaths(projectRoot: string, source: string, text: string): NamedPath[] {
    const seen = new Set<string>();
    const out: NamedPath[] = [];
    for (const re of [BACKTICKED, LINK_TARGET]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            // A backticked span immediately followed by `](` is a link LABEL, and
            // the real path is the target that follows. Reading the label as a
            // claim was the module's largest source of false "dangling" verdicts:
            // the dominant link style in this package's own rule bodies is
            // [`contexts/execution/x.md`](../contexts/execution/x.md), whose label
            // carries an extension, resolves from the repository root, and is not
            // there — while the target, being `../`-relative, is separately and
            // correctly reported unresolvable. 49 of 57 dangling paths in the
            // generated `.windsurfrules` concatenation were this one bug.
            if (re === BACKTICKED && text.slice(m.index + m[0].length, m.index + m[0].length + 2) === '](') continue;
            const raw = (m[1] ?? '').trim();
            if (!_looksLikePath(projectRoot, raw) || seen.has(raw)) continue;
            seen.add(raw);
            out.push({ source, raw, normalised: null, outcome: 'unresolvable' });
        }
    }
    return out;
}

/** Classify one extracted path against the filesystem. */
export function classifyNamedPath(projectRoot: string, entry: NamedPath): NamedPath {
    for (const { test, reason } of UNRESOLVABLE_REASONS) {
        if (test(entry.raw)) return { ...entry, normalised: null, outcome: 'unresolvable', reason };
    }
    const rel = entry.raw.replace(/^\.\//, '').replace(/\/$/, '');
    if (rel === '') {
        return { ...entry, normalised: null, outcome: 'unresolvable', reason: 'empty after normalisation' };
    }
    const abs = path.join(projectRoot, rel);
    // A path that escapes the root after joining is unresolvable, not absent.
    if (!path.resolve(abs).startsWith(path.resolve(projectRoot))) {
        return { ...entry, normalised: rel, outcome: 'unresolvable', reason: 'escapes the repository root' };
    }
    return { ...entry, normalised: rel, outcome: fs.existsSync(abs) ? 'present' : 'dangling' };
}

/** Every path every present root instruction file names, classified. */
export function resolveInstructionPaths(projectRoot: string): NamedPath[] {
    const out: NamedPath[] = [];
    for (const rel of ROOT_INSTRUCTION_FILES) {
        const abs = path.join(projectRoot, rel);
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf8');
        } catch {
            continue;
        }
        for (const entry of extractNamedPaths(projectRoot, rel, text)) {
            out.push(classifyNamedPath(projectRoot, entry));
        }
    }
    return out;
}

/**
 * Step 1.2 — the check that would have caught all three observed trees.
 *
 * `fail` on a dangling path, because a root file describing a layer that is not
 * there is a real defect the consumer can act on. `unresolvable` alone is never
 * a fail: it is this checker declining to guess, and reporting it as a fault
 * would be the checker blaming the tree for its own limit.
 */
export function checkInstructionPaths(projectRoot: string): WiringCheck {
    const id = 'instruction-path-reach';
    const named = resolveInstructionPaths(projectRoot);
    if (named.length === 0) {
        return {
            id,
            status: 'skipped',
            message: 'no root instruction file names a repository path — nothing to resolve',
            remedy: '',
        };
    }
    const dangling = named.filter((n) => n.outcome === 'dangling');
    const unresolvable = named.filter((n) => n.outcome === 'unresolvable');
    const present = named.length - dangling.length - unresolvable.length;
    const tail =
        unresolvable.length === 0
            ? ''
            : ` ${unresolvable.length} path(s) THIS CHECKER could not interpret, which is not the same as absent: ` +
              unresolvable.map((n) => `${n.source} → ${n.raw} (${n.reason ?? 'no reason recorded'})`).join('; ');
    if (dangling.length === 0) {
        return {
            id,
            status: 'ok',
            message: `${present} instruction-file path(s) resolve.${tail}`,
            remedy: '',
        };
    }
    return {
        id,
        status: 'fail',
        message:
            `${dangling.length} path(s) named by a root instruction file do NOT exist: ` +
            dangling.map((n) => `${n.source} → ${n.raw}`).join('; ') +
            `. ${present} resolved.${tail} An instruction file that over-reports is read as fact: ` +
            'every routing decision downstream of a dangling path is made against a layer that is not there. ' +
            'See rule `instruction-path-verification`.',
        remedy: 'install the missing layer, or delete the claim from the instruction file — a path named is a promise',
    };
}

// ---------------------------------------------------------------------------
// Step 1.3 — the version axis, as a three-way comparison
// ---------------------------------------------------------------------------

/**
 * Project settings files that may carry a pin, canonical first.
 *
 * `agent_settings.ts` reads the first two (`project_settings_path` falls back
 * from the canonical `agents/settings/` location to the repo root). The rest are
 * carried here as LEGACY: a consumer tree may still hold one, and the roadmap's
 * requirement is that a legacy filename is "named as legacy rather than
 * ignored". Reading one is not the same as honouring it — the label says which.
 */
export const SETTINGS_PIN_FILES: readonly { rel: string; legacy: boolean }[] = [
    { rel: path.join('agents', 'settings', '.agent-settings.yml'), legacy: false },
    { rel: '.agent-settings.yml', legacy: true },
    { rel: '.agent-project-settings.yml', legacy: true },
    { rel: 'agent-settings.yml', legacy: true },
];

/** A version pin found in a settings file. */
export interface VersionPin {
    /** Repo-relative file it came from. */
    file: string;
    legacy: boolean;
    version: string;
}

const PIN_RE = /^\s*(?:agent_config_version|version)\s*:\s*"?([^"'\s]+)"?\s*$/m;
const LOCK_VERSION_RE = /^\s*agent_config_version\s*:\s*"?([^"\s]+)"?\s*$/m;

/** Every pin the tree actually carries, canonical first. */
export function readVersionPins(projectRoot: string): VersionPin[] {
    const out: VersionPin[] = [];
    for (const { rel, legacy } of SETTINGS_PIN_FILES) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
        } catch {
            continue;
        }
        const m = PIN_RE.exec(text);
        if (m?.[1] !== undefined) out.push({ file: rel, legacy, version: m[1] });
    }
    return out;
}

/** The version recorded by the install that wrote the lockfile. */
export function readInstalledVersion(projectRoot: string): string | null {
    try {
        const text = fs.readFileSync(path.join(projectRoot, 'agents', 'installed-tools.lock'), 'utf8');
        return LOCK_VERSION_RE.exec(text)?.[1] ?? null;
    } catch {
        return null;
    }
}

/**
 * Step 1.3 — pinned, installed, and resolvable-now, printed TOGETHER.
 *
 * Printing them together is the whole point: each number alone reads as
 * correct, and only the comparison shows the drift. A pin under a legacy
 * filename is reported WITH the legacy label, never dropped — the observed tree
 * pinned a version several majors behind the installed projection under exactly
 * such a filename, and a checker that skipped the file would have called that
 * tree clean.
 */
export function checkVersionAxis(projectRoot: string, resolvableNow: string | null): WiringCheck {
    const id = 'version-axis';
    const pins = readVersionPins(projectRoot);
    const installed = readInstalledVersion(projectRoot);
    if (pins.length === 0 && installed === null) {
        return { id, status: 'skipped', message: 'no version pin and no install lockfile in this tree', remedy: '' };
    }
    const pinText =
        pins.length === 0
            ? 'pinned: none'
            : `pinned: ${pins.map((p) => `${p.version} (${p.file}${p.legacy ? ', LEGACY filename' : ''})`).join(' · ')}`;
    const line = `${pinText} · installed: ${installed ?? 'unknown'} · resolvable now: ${resolvableNow ?? 'unknown'}`;
    const divergent = pins.filter((p) => installed !== null && p.version !== installed);
    if (divergent.length === 0) {
        return { id, status: 'ok', message: line, remedy: '' };
    }
    return {
        id,
        status: 'warn',
        message:
            `${line} — ${divergent.length} pin(s) disagree with the installed projection. ` +
            'A pin behind the installed tree is ordinary manifest-versus-lockfile drift, ' +
            'and it is only visible as a comparison: each number alone reads as correct.',
        remedy: 'reconcile the pin with the installed version, or migrate a legacy settings file into the canonical location',
    };
}

// ---------------------------------------------------------------------------
// Step 5.2 — the local override set, as identity and a count only
// ---------------------------------------------------------------------------

/**
 * One overridden shipped artifact: its identity and how many layers carry it.
 *
 * PII-EXCLUSION BY CONSTRUCTION. This type has NO field capable of holding a
 * path, a diff, or any consumer content — the shape `artifact-engagement-recording`
 * § "PII-exclusion-by-construction" requires, where privacy is a property of
 * the schema rather than of a scrubbing pass that could fail. `kind` and `name`
 * are the artifact's identity in THIS package's own namespace, so they carry
 * nothing about the consumer; `layers` is a small integer. Never widen this
 * with a `path`, `source`, `diff`, `notes`, or `extra: unknown` field.
 */
export interface OverrideSignal {
    kind: 'rule' | 'skill' | 'command';
    /** The shipped artifact's own name — this package's identifier, not a path. */
    name: string;
    /** How many override layers carry an artifact of this identity. */
    layers: number;
}

/** Override layers a consumer install may carry, shallowest first. */
const OVERRIDE_LAYERS: readonly string[] = [
    path.join('agents', 'overrides'),
    path.join('.agent', 'overrides'),
];

const KIND_DIRS: readonly { dir: string; kind: OverrideSignal['kind'] }[] = [
    { dir: 'rules', kind: 'rule' },
    { dir: 'skills', kind: 'skill' },
    { dir: 'commands', kind: 'command' },
];

/**
 * The local override set: which shipped artifacts this tree overrides, and in
 * how many layers. A count of 1 is an ordinary local customisation. A count
 * above 1 is the signal — the same artifact overridden independently is the
 * cheapest available evidence that a shipped default is wrong.
 *
 * The signal is READ here and acted on nowhere: turning an aggregate into a
 * proposal is the upstream-contribution path's job, and a single tree cannot
 * clear the generality bar on its own.
 */
export function collectOverrideSet(projectRoot: string): OverrideSignal[] {
    const counts = new Map<string, OverrideSignal>();
    for (const layer of OVERRIDE_LAYERS) {
        for (const { dir, kind } of KIND_DIRS) {
            let entries: string[];
            try {
                entries = fs.readdirSync(path.join(projectRoot, layer, dir));
            } catch {
                continue;
            }
            for (const entry of entries) {
                const name = entry.replace(/\.md$/, '');
                if (name === '' || name.startsWith('.')) continue;
                const key = `${kind}:${name}`;
                const prev = counts.get(key);
                counts.set(key, { kind, name, layers: (prev?.layers ?? 0) + 1 });
            }
        }
    }
    return [...counts.values()].sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`));
}

/** Only the repeated ones — a single override is not a signal about a default. */
export function repeatedOverrides(set: readonly OverrideSignal[]): OverrideSignal[] {
    return set.filter((s) => s.layers > 1);
}

/** Step 5.2 — report the local override set inside a flow a consumer already runs. */
export function checkOverrideSet(projectRoot: string): WiringCheck {
    const id = 'override-set';
    const set = collectOverrideSet(projectRoot);
    if (set.length === 0) {
        return { id, status: 'skipped', message: 'no shipped artifact is overridden in this tree', remedy: '' };
    }
    const repeated = repeatedOverrides(set);
    const names = set.map((s) => `${s.kind}:${s.name}×${s.layers}`).join(' · ');
    if (repeated.length === 0) {
        return {
            id,
            status: 'ok',
            message: `${set.length} shipped artifact(s) overridden locally, each once: ${names}`,
            remedy: '',
        };
    }
    return {
        id,
        status: 'warn',
        message:
            `${repeated.length} shipped artifact(s) overridden in more than one layer: ${names}. ` +
            'A repeatedly overridden default is a candidate for an upstream proposal — but ONE tree is not ' +
            'evidence about a default. It is one input to an aggregate across independent consumers.',
        remedy: 'route it through the upstream-contribution path, never by changing a shipped default on one install',
    };
}

// ---------------------------------------------------------------------------
// Wiring — the shape `cmd_doctor` consumes
// ---------------------------------------------------------------------------

export const REACH_CHECK_IDS = ['instruction-path-reach', 'version-axis', 'override-set'] as const;

export function reachRunners(opts: {
    projectRoot: string;
    resolvableVersion: string | null;
}): Record<string, () => WiringCheck> {
    return {
        'instruction-path-reach': () => checkInstructionPaths(opts.projectRoot),
        'version-axis': () => checkVersionAxis(opts.projectRoot, opts.resolvableVersion),
        'override-set': () => checkOverrideSet(opts.projectRoot),
    };
}
