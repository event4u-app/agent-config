#!/usr/bin/env node
/**
 * Enforce cross-pack reference boundaries.
 *
 * Walks every markdown link in every source artefact and verifies the link
 * target's pack is the same pack, `core` (always allowed), or reachable from
 * the source pack's `requires` graph. A link that crosses an undeclared pack
 * boundary is dead the moment a consumer installs the source pack without the
 * target's pack.
 *
 * ## Scan-root repair (2026-08-02) — what changed and what parity survives
 *
 * This script was ported from a retired Python original and its header claimed
 * byte-exact parity with it ("No behaviour changes — historical quirks
 * preserved"). That claim is now PARTLY FALSE and is corrected here rather
 * than left standing:
 *
 * - **BROKEN deliberately:** the scan root. The original walked the retired
 *   per-package source container under `packages/` — a tree ADR-051 split and
 *   a later commit deleted. The gate therefore printed `no packages/ tree to
 *   lint — skipping` and exited 0 on every run since — it enforced nothing.
 *   The corpus is now the live artefact tree via the shared resolver
 *   (`_lib/agent_src.iter_artefacts`), and an empty corpus is a LOUD failure
 *   (`_lib/scan_scope.assertScanned`), not a silent skip.
 * - **BROKEN deliberately:** pack attribution. The original read the pack from
 *   the `packages/<pack>/` directory the artefact lived in. That layout is
 *   gone, so the pack now comes from the artefact's own `packs:` frontmatter
 *   (see `_packs_of` for the full rule, including the fail-safe).
 * - **BROKEN deliberately:** `requires` is expanded TRANSITIVELY. The original
 *   compared against the direct list only, which reports a violation for a
 *   target the resolver provably does install (`nextjs` → `javascript`, via
 *   `typescript`). `src/config/discovery/packs.yml` documents `requires` as
 *   "the hard dependency graph (transitive, acyclic) the resolver expands";
 *   this gate now matches that definition.
 * - **BROKEN deliberately:** exit code 2 is new (dead scan scope). 0 and 1
 *   keep their meanings.
 * - **BROKEN deliberately (2026-10-01):** the always-installed set is the
 *   hard-coded `core` PLUS every pack flagged `always_on: true`. The original
 *   knew only `core`, so it reported a violation for a target the resolver
 *   provably does install — the same defect shape as the direct-vs-transitive
 *   `requires` comparison above. `config/packs.resolve_active_packs` seeds the
 *   active set with the always-on packs before expanding any selection, and
 *   `docs/contracts/capability-packs.md` § Always-on packs states such a pack
 *   "cannot be deselected". One-way: a link OUT of an always-on pack into a
 *   gated one still dangles and is still reported.
 * - **STILL HOLDS:** the CLI surface (`--format text|json`, `--quiet`, `-h`),
 *   the link regex and its fragment/query stripping, link-resolution semantics
 *   (external / absolute / out-of-tree targets ignored), the allow rule
 *   (same pack · always-installed · declared `requires`), the per-violation text and
 *   JSON shapes, the stdout/stderr split, and exit 0 clean / 1 violations.
 * - **ADDED (2026-10-07):** a `scanned: <N>` line on every path (stdout in text
 *   mode, stderr under `--format json` so the payload stays parseable), and
 *   `--self-test`, which runs this CLI against planted fixture trees. Both are
 *   what `src/config/gate-coverage.yml` asks of a gate a pull request runs.
 *
 * ## Where the `requires` graph is read from
 *
 * `src/config/discovery/packs.yml` is the source of truth for the pack
 * vocabulary and its `requires` edges — `generate_pack_manifests.ts` DERIVES
 * every `src/{packs,domains}/<pack>/pack.yaml` from it. Reading the vocabulary
 * therefore covers all 33 pack ids, including the three (`frontend-design`,
 * `scale-discipline`, `history-discipline`) that artefacts declare but that own
 * no pack-home directory and so have no generated manifest. The manifests are
 * still read, as an overlay, for any pack home the vocabulary does not list
 * (today: `core`).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
    SRC_AGENT,
    SRC_DOMAINS,
    SRC_RULES,
    SRC_SKILLS,
    iter_artefacts,
} from './_lib/agent_src.js';
import { checkRatchet } from './_lib/gate_baseline.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { parse_frontmatter } from './validate_frontmatter.js';

const _HERE = path.resolve(fileURLToPath(import.meta.url));

// Module-level paths are test seams (mirrors the `_set_paths` shape used by
// the sibling `lint_artefact_frontmatter`). Mutable lets + a setter.
let ROOT = _realpath(path.resolve(path.dirname(_HERE), '..', '..'));
let VOCAB = path.join(ROOT, 'src', 'config', 'discovery', 'packs.yml');

const _DEFAULT_ROOT = ROOT;

/**
 * True while a caller has repointed the root at a fixture tree.
 *
 * Stateless on purpose (compared against the value captured at import) so a
 * test restoring the real path also restores real-repo behaviour. Two things
 * key off it: the scan roots — an injected tree is scanned EXCLUSIVELY, because
 * the shared resolver still points at the real repo and would otherwise drag
 * the whole corpus into a fixture run — and the violation ratchet, which
 * records repo debt and must never judge a fixture.
 */
function _paths_overridden(): boolean {
    return ROOT !== _DEFAULT_ROOT;
}

/**
 * Test seam: repoint the root (and optionally the vocabulary file).
 *
 * Passing the default root restores real-repo behaviour, vocabulary included.
 */
function _set_paths_for_test(opts: { root?: string; vocab?: string }): void {
    if (opts.root !== undefined) {
        ROOT = opts.root;
        VOCAB =
            ROOT === _DEFAULT_ROOT
                ? path.join(ROOT, 'src', 'config', 'discovery', 'packs.yml')
                : path.join(ROOT, 'packs.yml');
    }
    if (opts.vocab !== undefined) {
        VOCAB = opts.vocab;
    }
}

// `--self-test` drives this CLI from a CHILD process, which cannot reach the
// setter above, so the fixture root is also readable from the environment.
// Applied through the setter rather than at the `ROOT` declaration, so a
// fixture run is still recognised as overridden and never judged by the
// repo's violation ratchet.
// Honoured only inside a self-test child, so an inherited value can never
// redirect the production gate or switch its ratchet off.
const _ENV_ROOT =
    process.env['GATE_SELF_TEST_CHILD'] === '1' ? process.env['LINT_PACK_BOUNDARIES_ROOT'] : undefined;
if (_ENV_ROOT !== undefined && _ENV_ROOT !== '') {
    _set_paths_for_test({ root: _realpath(path.resolve(_ENV_ROOT)) });
}

// [..](target) with an optional #fragment / ?query stripped from the target.
const LINK_RE = /\[[^\]]*\]\(([^)#?]+)(?:[#?][^)]*)?\)/g;

/** A pack every install carries — a link into it can never dangle. */
const ALWAYS_INSTALLED = 'core';

/**
 * Packs every projection carries, so a link INTO one can never dangle.
 *
 * `core` is the hard-coded floor. Beyond it, `always_on: true` in the pack
 * vocabulary means exactly this: `config/packs.resolve_active_packs` seeds the
 * active set with every always-on pack BEFORE expanding the selected profile's
 * `requires` closure, and `docs/contracts/capability-packs.md` § Always-on
 * packs states the pack "is never gated by the selected profile, workspace, or
 * pack set, and it cannot be deselected".
 *
 * Reading only `core` was the same class of defect this file's header already
 * records for the direct-vs-transitive `requires` comparison: the gate reported
 * a violation for a target the resolver provably does install. The direction is
 * one-way — a link OUT of an always-on pack into a gated one still dangles and
 * is still a violation.
 */
function _always_installed_packs(): Set<string> {
    const out = new Set<string>([ALWAYS_INSTALLED]);
    if (_exists(VOCAB)) {
        const vocab = parseYaml(fs.readFileSync(VOCAB, 'utf-8'), { version: '1.1' });
        if (Array.isArray(vocab)) {
            for (const entry of vocab) {
                if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
                    const e = entry as Record<string, unknown>;
                    if (typeof e['id'] === 'string' && e['always_on'] === true) {
                        out.add(e['id']);
                    }
                }
            }
        }
    }
    for (const dir of _pack_home_dirs()) {
        const meta = _load_pack_meta(dir);
        if (meta['always_on'] === true) {
            const id = typeof meta['id'] === 'string' ? meta['id'] : path.basename(dir);
            out.add(id);
        }
    }
    return out;
}

type ViolationKind =
    /** Link crosses into a pack the source pack does not require. */
    | 'cross-pack'
    /** A unit-defining artefact whose own pack could not be determined. */
    | 'unresolved-pack';

interface ViolationRecord {
    kind: ViolationKind;
    source_pack: string;
    target_pack: string;
    source: string;
    target: string;
    link: string;
}

/**
 * Which edge permits a cross-pack link. `null` is the violation case.
 *
 * `suggests` is the advisory, non-installing edge added for the base-into-
 * narrow class (D5 of `road-to-gates-a-pull-request-can-hear`, AI council
 * 2026-10-07). It is the WEAKEST promise in the list, which is why the ranking
 * below exists: a link that needs it is reported as needing it, never as a
 * `requires` link that happens to also hold.
 */
type PermitReason = 'same-pack' | 'always-installed' | 'requires' | 'suggests' | null;

/** Strength order — lower is a stronger guarantee that the target is present. */
const PERMIT_RANK: Record<Exclude<PermitReason, null>, number> = {
    'same-pack': 0,
    'always-installed': 1,
    requires: 2,
    suggests: 3,
};

/** A link permitted only by `suggests`, kept for the `--show-permitted` report. */
interface PermittedRecord {
    source_pack: string;
    target_pack: string;
    source: string;
    target: string;
    link: string;
    reason: Exclude<PermitReason, null>;
}

/** Mirror Python `Path.resolve()`: canonicalize existing prefix, append rest. */
function _realpath(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        // Resolve the longest existing ancestor, then re-append the tail.
        const abs = path.resolve(p);
        const parts = abs.split(path.sep);
        for (let i = parts.length; i > 0; i--) {
            const prefix = parts.slice(0, i).join(path.sep) || path.sep;
            try {
                const real = fs.realpathSync(prefix);
                const tail = parts.slice(i);
                return tail.length > 0 ? path.join(real, ...tail) : real;
            } catch {
                continue;
            }
        }
        return abs;
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

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _load_pack_meta(pkg_dir: string): Record<string, unknown> {
    const pack_yaml = path.join(pkg_dir, 'pack.yaml');
    if (!_exists(pack_yaml)) {
        return {};
    }
    const data = parseYaml(fs.readFileSync(pack_yaml, 'utf-8'), { version: '1.1' });
    return data !== null && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
}

/** Recursively list `*.md` files under `dir`, sorted (sorted(rglob)). */
function _rglobMdSorted(dir: string): string[] {
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
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out.sort();
}

/**
 * The scan roots, named individually rather than via one container.
 *
 * Deliberately NOT `artefact_roots()`: that category-append view also yields
 * `src/templates`, an unrelated consumer-scaffold tree this gate never
 * scanned. Repairing a root must restore the old scope, not silently widen it.
 * `iter_artefacts()` (used below) walks exactly these four.
 */
function _scan_roots(): string[] {
    if (_paths_overridden()) {
        // Fixture mode — the injected tree is the whole world.
        return [
            path.join(ROOT, 'skills'),
            path.join(ROOT, 'rules'),
            path.join(ROOT, 'commands'),
        ].filter(_isDir);
    }
    return [SRC_AGENT(), SRC_SKILLS(), SRC_RULES(), SRC_DOMAINS()].filter(_isDir);
}

/** Every source artefact, as absolute paths, in deterministic order. */
function _iter_source_files(): string[] {
    if (_paths_overridden()) {
        const out: string[] = [];
        for (const root of _scan_roots()) {
            out.push(..._rglobMdSorted(root));
        }
        return out;
    }
    return [...iter_artefacts()];
}

/** Pack-home directories carrying a generated `pack.yaml`. */
function _pack_home_dirs(): string[] {
    const parents = _paths_overridden()
        ? [path.join(ROOT, 'packs')]
        : [path.join(ROOT, 'src', 'packs'), path.join(ROOT, 'src', 'domains')];
    const out: string[] = [];
    for (const parent of parents) {
        if (!_isDir(parent)) {
            continue;
        }
        for (const name of fs.readdirSync(parent).sort()) {
            const dir = path.join(parent, name);
            if (_isDir(dir) && _exists(path.join(dir, 'pack.yaml'))) {
                out.push(dir);
            }
        }
    }
    return out;
}

/**
 * `pack id -> direct requires`.
 *
 * `packs.yml` first (the source of truth every `pack.yaml` is generated from,
 * and the only place the three home-less packs are declared), then the
 * manifests as an overlay for pack homes the vocabulary does not list.
 */
function _pack_requires(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

    if (_exists(VOCAB)) {
        const vocab = parseYaml(fs.readFileSync(VOCAB, 'utf-8'), { version: '1.1' });
        if (Array.isArray(vocab)) {
            for (const entry of vocab) {
                if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
                    const e = entry as Record<string, unknown>;
                    if (typeof e['id'] === 'string') {
                        out.set(e['id'], asList(e['requires']));
                    }
                }
            }
        }
    }
    for (const dir of _pack_home_dirs()) {
        const meta = _load_pack_meta(dir);
        const id = typeof meta['id'] === 'string' ? meta['id'] : path.basename(dir);
        if (!out.has(id)) {
            out.set(id, asList(meta['requires']));
        }
    }
    return out;
}

/**
 * `pack id -> direct suggests`.
 *
 * Read from the same two sources as `_pack_requires`, and deliberately NOT
 * expanded: `suggests` is one-hop. Transitive expansion would give the
 * advisory edge the same reach as the install-forcing one, which is the
 * property the base-into-narrow decision depends on it not having.
 */
function _pack_suggests(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

    if (_exists(VOCAB)) {
        const vocab = parseYaml(fs.readFileSync(VOCAB, 'utf-8'), { version: '1.1' });
        if (Array.isArray(vocab)) {
            for (const entry of vocab) {
                if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
                    const e = entry as Record<string, unknown>;
                    if (typeof e['id'] === 'string') {
                        out.set(e['id'], asList(e['suggests']));
                    }
                }
            }
        }
    }
    for (const dir of _pack_home_dirs()) {
        const meta = _load_pack_meta(dir);
        const id = typeof meta['id'] === 'string' ? meta['id'] : path.basename(dir);
        if (!out.has(id)) {
            out.set(id, asList(meta['suggests']));
        }
    }
    return out;
}

/** Transitive expansion of `requires`, cycle-safe. */
function _requires_closure(pack: string, direct: Map<string, string[]>): Set<string> {
    const seen = new Set<string>();
    const stack = [...(direct.get(pack) ?? [])];
    while (stack.length > 0) {
        const next = stack.pop() as string;
        if (seen.has(next)) {
            continue;
        }
        seen.add(next);
        for (const dep of direct.get(next) ?? []) {
            stack.push(dep);
        }
    }
    return seen;
}

/** Packs declared in an artefact's own frontmatter (`packs:`). */
function _declared_packs(p: string): string[] {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return [];
    }
    const [fm] = parse_frontmatter(text);
    if (fm === null) {
        return [];
    }
    const packs = fm['packs'];
    if (Array.isArray(packs)) {
        return packs.map(String).filter((s) => s !== '');
    }
    return typeof packs === 'string' && packs !== '' ? [packs] : [];
}

/**
 * A unit-defining artefact — one ADR-013 requires to declare `packs:`.
 *
 * These are the files whose pack MUST be resolvable; the fail-safe below turns
 * an unresolvable one into a violation rather than a silent exclusion.
 */
function _is_unit_file(abs: string): boolean {
    const base = path.basename(abs);
    if (base === 'SKILL.md') {
        return true;
    }
    // `command.md` only counts inside a command home. The same basename is
    // also used by the authoring SCAFFOLDS under `src/agent-src/templates/`,
    // which carry no frontmatter on purpose (quarantined in
    // `src/config/discovery/unassigned-artefacts.yml`) and are not commands.
    const commandRoot = _paths_overridden() ? path.join(ROOT, 'commands') : SRC_DOMAINS();
    if (base === 'command.md') {
        return !_relPosix(abs, commandRoot).startsWith('..');
    }
    const rulesRoot = _paths_overridden() ? path.join(ROOT, 'rules') : SRC_RULES();
    return path.dirname(abs) === rulesRoot && base.endsWith('.md');
}

/**
 * Resolve an artefact's pack set. Returns `[]` when it cannot be determined.
 *
 * The rule, in order (the `packages/<pack>/…` container the original gate read
 * no longer exists, so attribution is declaration-first):
 *
 *   1. the artefact's own `packs:` frontmatter;
 *   2. else the nearest ancestor `SKILL.md`'s packs — a skill's auxiliary
 *      reference files carry no frontmatter and ship with their skill;
 *   3. else, under `src/domains/<pack>/`, the pack home directory it lives in;
 *   4. else UNASSIGNED — contexts, personas, templates and other cross-cutting
 *      surfaces that legitimately belong to no pack (registry:
 *      `src/config/discovery/unassigned-artefacts.yml`).
 *
 * Fail-safe: an UNASSIGNED artefact is not indexed, so it is never a source and
 * never launders a link as a target — and the count of them is printed in the
 * summary, so the exclusion is visible rather than silent. For the classes that
 * MUST declare a pack (`_is_unit_file`) an unassigned result is reported as an
 * `unresolved-pack` violation: such an artefact cannot be boundary-checked and
 * must not pass by omission. (`lint_artefact_frontmatter` enforces the same
 * `packs:` presence independently, so this is a second lock, not the only one.)
 */
function _packs_of(abs: string, cache: Map<string, string[]>): string[] {
    const cached = cache.get(abs);
    if (cached !== undefined) {
        return cached;
    }
    let packs = _declared_packs(abs);

    if (packs.length === 0) {
        // Nearest ancestor SKILL.md.
        let dir = path.dirname(abs);
        const stopAt = path.parse(dir).root;
        while (dir !== stopAt && dir.startsWith(ROOT)) {
            const owner = path.join(dir, 'SKILL.md');
            if (owner !== abs && _isFile(owner)) {
                packs = _declared_packs(owner);
                break;
            }
            dir = path.dirname(dir);
        }
    }
    if (packs.length === 0 && !_paths_overridden()) {
        const rel = _relPosix(abs, SRC_DOMAINS());
        if (!rel.startsWith('..') && rel.includes('/')) {
            packs = [rel.split('/')[0] as string];
        }
    }
    cache.set(abs, packs);
    return packs;
}

/** Map repo-relative POSIX artefact path -> declared pack ids. */
function _build_artefact_index(): {
    index: Map<string, string[]>;
    unassigned: string[];
    scanned: number;
} {
    const index = new Map<string, string[]>();
    const unassigned: string[] = [];
    const cache = new Map<string, string[]>();
    const files = _iter_source_files();
    for (const abs of files) {
        const packs = _packs_of(abs, cache);
        const rel = _relPosix(abs, ROOT);
        if (packs.length === 0) {
            unassigned.push(rel);
            continue;
        }
        index.set(rel, packs);
    }
    return { index, unassigned, scanned: files.length };
}

/** Resolve a markdown link target to a repo-relative path, or null. */
function _resolve_link(source_file: string, raw: string): string | null {
    const target = raw.trim();
    if (
        target === '' ||
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('mailto:') ||
        target.startsWith('ftp://')
    ) {
        return null;
    }
    if (target.startsWith('/')) {
        return null; // absolute web paths, ignored
    }
    let resolved: string;
    try {
        resolved = _realpath(path.resolve(path.dirname(source_file), target));
    } catch {
        return null;
    }
    // relative_to(ROOT) raises ValueError if not under ROOT → return None.
    const rel = path.relative(ROOT, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join('/');
}

function _scan_file(p: string): string[] {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return [];
    }
    const out: string[] = [];
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(text)) !== null) {
        out.push(m[1] as string);
    }
    return out;
}

/**
 * Which edge, if any, lets a link out of `source_pack` reach `target_pack`.
 *
 * `null` is the violation case. The reason is returned rather than a bare
 * boolean because `suggests` is advisory: a reader who sees a permitted
 * base-into-narrow link needs to know it was permitted by an edge that does
 * NOT install the target, which is a different promise from `requires`.
 */
function _permit_reason(
    source_pack: string,
    target_pack: string,
    requires: string[],
    always_installed: ReadonlySet<string> = new Set([ALWAYS_INSTALLED]),
    suggests: readonly string[] = [],
): PermitReason {
    if (source_pack === target_pack) {
        return 'same-pack';
    }
    if (always_installed.has(target_pack)) {
        return 'always-installed';
    }
    if ((requires || []).includes(target_pack)) {
        return 'requires';
    }
    // One-hop and one-way by construction: the caller passes the SOURCE pack's
    // own direct `suggests` list, never a closure over it. A transitive
    // advisory edge would re-create the install-forcing reach `requires` has,
    // which is the property this edge exists not to have.
    return suggests.includes(target_pack) ? 'suggests' : null;
}

function _is_allowed(
    source_pack: string,
    target_pack: string,
    requires: string[],
    always_installed: ReadonlySet<string> = new Set([ALWAYS_INSTALLED]),
    suggests: readonly string[] = [],
): boolean {
    return _permit_reason(source_pack, target_pack, requires, always_installed, suggests) !== null;
}

/**
 * Set-level allow rule.
 *
 * EVERY source pack must reach SOME target pack: a multi-pack artefact ships
 * in each of its packs independently, so a link that resolves in only one of
 * them is dead in the others. A multi-pack TARGET is present as soon as any one
 * of its packs is reachable.
 */
function _link_allowed(
    source_packs: readonly string[],
    target_packs: readonly string[],
    closureOf: (pack: string) => Set<string>,
    always_installed: ReadonlySet<string> = new Set([ALWAYS_INSTALLED]),
    suggestsOf: (pack: string) => readonly string[] = () => [],
): boolean {
    return (
        _link_permit_reason(source_packs, target_packs, closureOf, always_installed, suggestsOf) !==
        null
    );
}

/**
 * The weakest edge the link relies on, or `null` when nothing permits it.
 *
 * Weakest, not first: a link permitted for one source pack by `requires` and
 * for another only by `suggests` is reported as `suggests`, because that is
 * the promise a consumer actually gets.
 */
function _link_permit_reason(
    source_packs: readonly string[],
    target_packs: readonly string[],
    closureOf: (pack: string) => Set<string>,
    always_installed: ReadonlySet<string> = new Set([ALWAYS_INSTALLED]),
    suggestsOf: (pack: string) => readonly string[] = () => [],
): PermitReason {
    let weakest: PermitReason = 'same-pack';
    for (const s of source_packs) {
        const reach = [...closureOf(s)];
        const sug = suggestsOf(s);
        let best: PermitReason = null;
        for (const t of target_packs) {
            const r = _permit_reason(s, t, reach, always_installed, sug);
            if (r !== null && (best === null || PERMIT_RANK[r] < PERMIT_RANK[best])) {
                best = r;
            }
        }
        if (best === null) {
            return null;
        }
        if (PERMIT_RANK[best] > PERMIT_RANK[weakest]) {
            weakest = best;
        }
    }
    return weakest;
}

/** Mirror Python `json.dump(obj, indent=2)` with `ensure_ascii=True`. */
function _json_dumps_ascii(obj: unknown): string {
    const raw = JSON.stringify(obj, null, 2);
    let out = '';
    for (const ch of raw) {
        const code = ch.codePointAt(0) as number;
        if (code < 0x80) {
            out += ch;
        } else {
            for (let k = 0; k < ch.length; k++) {
                out += '\\u' + ch.charCodeAt(k).toString(16).padStart(4, '0');
            }
        }
    }
    return out;
}

interface ParsedArgs {
    format: 'text' | 'json';
    quiet: boolean;
    /** List the links permitted only by an advisory `suggests` edge. */
    show_permitted: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let format: 'text' | 'json' = 'text';
    let quiet = false;
    let show_permitted = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i] as string;
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
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '--show-permitted') {
            show_permitted = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_pack_boundaries [-h] [--format {text,json}] [--quiet] ' +
                    '[--show-permitted] [--self-test]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { format, quiet, show_permitted };
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_pack_boundaries: error: ${message}\n`);
    process.exit(2);
}

/**
 * Plant fixture trees and run this gate's real CLI against each one.
 *
 * Three rejecting cases cover the three exits a pull request can be failed by:
 * an undeclared cross-pack link, an artefact with no resolvable pack, and an
 * empty corpus. The two accepting cases pin the allow rule from the other side,
 * so a gate that started rejecting everything fails here too.
 */
function selfTest(): number {
    const plant = (name: string, files: Record<string, string>): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `lpb-selftest-${name}-`));
        for (const [rel, body] of Object.entries(files)) {
            const p = path.join(dir, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, body, 'utf-8');
        }
        return dir;
    };
    const skill = (slug: string, packs: string, body: string): [string, string] => [
        `skills/${slug}/SKILL.md`,
        `---\nname: ${slug}\npacks: [${packs}]\n---\n\n${body}\n`,
    ];
    const run = (dir: string): number => {
        const prev = process.env['LINT_PACK_BOUNDARIES_ROOT'];
        process.env['LINT_PACK_BOUNDARIES_ROOT'] = dir;
        try {
            return runGateCli(
                _DEFAULT_ROOT,
                path.join('src', 'scripts', 'lint_pack_boundaries.ts'),
                ['--quiet'],
                _DEFAULT_ROOT,
            );
        } finally {
            if (prev === undefined) {
                delete process.env['LINT_PACK_BOUNDARIES_ROOT'];
            } else {
                process.env['LINT_PACK_BOUNDARIES_ROOT'] = prev;
            }
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };
    const twoPacks = '- id: alpha\n  requires: []\n- id: beta\n  requires: []\n';
    // A reject case counts only on the exit it names: a crash or a dead-scope
    // exit on a fixture that should yield a finding reads as NOT rejected.
    const rejectsWith = (want: number, got: number): number => (got === want ? 1 : 0);

    return runSelfTest({
        gate: 'lint_pack_boundaries',
        minCases: 5,
        minRejectCases: 3,
        cases: [
            {
                name: 'an undeclared cross-pack link is rejected with exit 1',
                expect: 'reject',
                run: () =>
                    rejectsWith(1, run(
                        plant('cross', {
                            'packs.yml': twoPacks,
                            ...Object.fromEntries([
                                skill('a-one', 'alpha', 'reaches [b](../b-one/SKILL.md)'),
                                skill('b-one', 'beta', 'leaf'),
                            ]),
                        }),
                    )),
            },
            {
                name: 'a SKILL.md with no packs is a finding (exit 1), never a silent pass',
                expect: 'reject',
                run: () =>
                    rejectsWith(1, run(
                        plant('nopack', {
                            'packs.yml': twoPacks,
                            'skills/nopack/SKILL.md': '---\nname: nopack\n---\n\nno packs key\n',
                        }),
                    )),
            },
            {
                name: 'an empty corpus is a dead scope (exit 2), not "no cross-pack drift"',
                expect: 'reject',
                run: () => rejectsWith(2, run(plant('empty', { 'packs.yml': twoPacks }))),
            },
            {
                name: 'a link declared through requires passes',
                expect: 'accept',
                run: () =>
                    run(
                        plant('declared', {
                            'packs.yml': '- id: alpha\n  requires: [beta]\n- id: beta\n  requires: []\n',
                            ...Object.fromEntries([
                                skill('a-one', 'alpha', 'reaches [b](../b-one/SKILL.md)'),
                                skill('b-one', 'beta', 'leaf'),
                            ]),
                        }),
                    ),
            },
            {
                name: 'a link inside one pack passes',
                expect: 'accept',
                run: () =>
                    run(
                        plant('same', {
                            'packs.yml': twoPacks,
                            ...Object.fromEntries([
                                skill('a-one', 'alpha', 'reaches [two](../a-two/SKILL.md)'),
                                skill('a-two', 'alpha', 'leaf'),
                            ]),
                        }),
                    ),
            },
        ],
    });
}

function main(argv?: readonly string[]): number {
    const rawArgv = argv ?? process.argv.slice(2);
    if (rawArgv.includes('--self-test')) {
        if (process.env['GATE_SELF_TEST_CHILD'] === '1') {
            process.stderr.write('lint_pack_boundaries: --self-test does not recurse\n');
            return 2;
        }
        return selfTest();
    }
    const args = parse_args(rawArgv);

    const { index: artefact_pack, unassigned, scanned } = _build_artefact_index();

    // Scope assertion: 0 artefacts means the root moved, not that the tree is
    // clean. That was this gate's shipped state until 2026-08-02 — it walked
    // the deleted `packages/` tree and skipped green forever.
    try {
        reportScanned(
            {
                gate: 'lint_pack_boundaries',
                scanned,
                units: 'artefact(s)',
                roots: _scan_roots().map((r) => _relPosix(r, ROOT) || '.'),
            },
            args.format === 'json'
                ? process.stderr.write.bind(process.stderr)
                : process.stdout.write.bind(process.stdout),
        );
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) {
            throw exc;
        }
        process.stderr.write(`❌  ${exc.message}\n`);
        return 2;
    }

    const pack_requires = _pack_requires();
    const pack_suggests = _pack_suggests();
    const suggestsOf = (pack: string): readonly string[] => pack_suggests.get(pack) ?? [];
    const always_installed = _always_installed_packs();
    const closureCache = new Map<string, Set<string>>();
    const closureOf = (pack: string): Set<string> => {
        let c = closureCache.get(pack);
        if (c === undefined) {
            c = _requires_closure(pack, pack_requires);
            closureCache.set(pack, c);
        }
        return c;
    };

    const violations: ViolationRecord[] = [];
    const permitted: PermittedRecord[] = [];

    // Fail-safe: a unit-defining artefact with no resolvable pack cannot be
    // boundary-checked, so it is a finding rather than a silent exclusion.
    for (const rel of unassigned) {
        if (_is_unit_file(path.join(ROOT, rel))) {
            violations.push({
                kind: 'unresolved-pack',
                source_pack: '(unresolved)',
                target_pack: '',
                source: rel,
                target: '',
                link: '',
            });
        }
    }

    for (const [rel_path, src_packs] of artefact_pack) {
        const source_file = path.join(ROOT, rel_path);
        for (const raw of _scan_file(source_file)) {
            const target_rel = _resolve_link(source_file, raw);
            if (target_rel === null) {
                continue;
            }
            const target_packs = artefact_pack.get(target_rel);
            if (target_packs === undefined) {
                continue; // docs/, scripts/, root files, unassigned — not pack-scoped
            }
            const reason = _link_permit_reason(
                src_packs,
                target_packs,
                closureOf,
                always_installed,
                suggestsOf,
            );
            if (reason !== null) {
                // Only the advisory edge is worth reporting: the other three
                // mean the target is installed, so there is nothing a reader
                // has to weigh.
                if (reason === 'suggests') {
                    permitted.push({
                        source_pack: src_packs.join('+'),
                        target_pack: target_packs.join('+'),
                        source: rel_path,
                        target: target_rel,
                        link: raw,
                        reason,
                    });
                }
                continue;
            }
            violations.push({
                kind: 'cross-pack',
                source_pack: src_packs.join('+'),
                target_pack: target_packs.join('+'),
                source: rel_path,
                target: target_rel,
                link: raw,
            });
        }
    }

    const verdict = _paths_overridden()
        ? null
        : checkRatchet({
              gate: 'lint_pack_boundaries',
              actual: violations.length,
              repoRoot: ROOT,
          });
    const ok = violations.length === 0 || (verdict !== null && verdict.ok);

    if (args.format === 'json') {
        process.stdout.write(
            _json_dumps_ascii({
                violations,
                count: violations.length,
                scanned,
                unassigned: unassigned.length,
                permitted_by_suggests: permitted,
                ratchet:
                    verdict === null ? null : { status: verdict.status, baseline: verdict.baseline },
            }) + '\n',
        );
        return ok ? 0 : 1;
    }

    if (!args.quiet) {
        process.stdout.write(
            `lint_pack_boundaries: scanned ${scanned} artefacts across ` +
                `${pack_requires.size} packs (${unassigned.length} outside pack scope)\n`,
        );
    }
    // The advisory edge is reported only when asked for. It permits a link
    // rather than excusing one, so printing it next to the violations on every
    // run would read as a finding; printing it never would hide which links a
    // non-installing edge is carrying.
    if (args.show_permitted) {
        for (const p of permitted) {
            process.stdout.write(
                `  ~ ${p.source_pack} -> ${p.target_pack} : ${p.source} \u2192 ${p.target} ` +
                    `(link: ${p.link}) — permitted by \`${p.reason}\`\n`,
            );
        }
        process.stdout.write(
            `${permitted.length} link(s) permitted by an advisory \`suggests\` edge\n`,
        );
    }
    for (const v of violations) {
        if (v.kind === 'unresolved-pack') {
            process.stdout.write(
                `  ✗ ${v.source} : no \`packs:\` declared and no owning pack — ` +
                    'cannot be boundary-checked\n',
            );
            continue;
        }
        process.stdout.write(
            `  ✗ ${v.source_pack} -> ${v.target_pack} : ${v.source} → ${v.target} ` +
                `(link: ${v.link})\n`,
        );
    }
    if (violations.length > 0) {
        process.stdout.write(
            `\n${violations.length} cross-pack violation(s) — declare 'requires' in ` +
                'pack.yaml or move the artefact\n',
        );
        if (verdict !== null) {
            if (verdict.ok) {
                process.stdout.write(`⚠️   ${verdict.message}\n`);
            } else {
                process.stderr.write(`❌  ${verdict.message}\n`);
            }
        }
    } else if (!args.quiet) {
        process.stdout.write('OK — no cross-pack drift\n');
    }
    return ok ? 0 : 1;
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
    type ViolationKind,
    type ViolationRecord,
    ROOT,
    LINK_RE,
    _build_artefact_index,
    _resolve_link,
    _scan_file,
    _always_installed_packs,
    type PermitReason,
    _is_allowed,
    _link_allowed,
    _link_permit_reason,
    _pack_suggests,
    _permit_reason,
    _load_pack_meta,
    _pack_requires,
    _requires_closure,
    _packs_of,
    _scan_roots,
    _set_paths_for_test,
    main,
};
