#!/usr/bin/env tsx
/**
 * Lint Phase-4 discovery frontmatter on every artefact.
 *
 * Ported from the retired Python `src/scripts/lint_artefact_frontmatter.py` (ADR-200,
 * Phase 4 / Wave 4b). The CLI contract is pinned — `--quiet`
 * flag, exit codes (0 clean, 1 violation), stdout/stderr split,
 * byte-identical finding messages (including Python-shaped list repr),
 * same scan trees and order, same `validate_frontmatter.parse_frontmatter`
 * splitter, same closed vocabularies.
 *
 * Walks skills / rules / commands / templates under `.agent-src.uncondensed/`
 * and asserts per-file that the five ADR-013 keys are present and
 * well-formed.
 *
 * Exits 0 clean, 1 on any violation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { SRC_AGENT, SRC_RULES, SRC_SKILLS, iter_commands } from './_lib/agent_src.js';
import { checkRatchet } from './_lib/gate_baseline.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';
import { parse_frontmatter } from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);

// Module-level paths are test seams (the Python tests monkeypatch ROOT / SRC
// / VOCAB_DIR). Mutable lets + setters mirror that.
let ROOT = path.resolve(path.dirname(_HERE), '..', '..');
let SRC = path.join(ROOT, '.agent-src.uncondensed');
let VOCAB_DIR = path.join(ROOT, 'src', 'config', 'discovery');

const _DEFAULT_ROOT = ROOT;
const _DEFAULT_SRC = SRC;

/**
 * True while a caller has repointed the roots at a fixture tree.
 *
 * Stateless on purpose (compared against the values captured at import, not a
 * sticky flag) so that a test restoring the real paths in `afterEach` also
 * restores real-repo behaviour. Two things key off it: the scan roots (an
 * injected container is scanned EXCLUSIVELY — the shared resolver still points
 * at the real repo and would otherwise drag the whole corpus into a fixture
 * run) and the violation ratchet, which records repo debt and must never judge
 * a fixture.
 */
function _paths_overridden(): boolean {
    return ROOT !== _DEFAULT_ROOT || SRC !== _DEFAULT_SRC;
}

/** Test seam: override the module-level scan roots (mirrors monkeypatch). */
function _set_paths(opts: { root?: string; src?: string; vocabDir?: string }): void {
    if (opts.root !== undefined) {
        ROOT = opts.root;
    }
    if (opts.src !== undefined) {
        SRC = opts.src;
    }
    if (opts.vocabDir !== undefined) {
        VOCAB_DIR = opts.vocabDir;
    }
}

const LIFECYCLES = new Set(['active', 'deprecated', 'experimental', 'archived']);
const TRUST_LEVELS = new Set([
    'core',
    'professional',
    'experimental',
    'advisory',
    'restricted',
]);
const TRUST_CONFIDENCE = new Set(['high', 'medium', 'low']);

function _load_vocab(): [Set<string>, Set<string>, Set<string>] {
    const ws = (parseYaml(fs.readFileSync(path.join(VOCAB_DIR, 'workspaces.yml'), 'utf-8'), {
        version: '1.1',
    }) || []) as Array<Record<string, unknown>>;
    const packs = (parseYaml(fs.readFileSync(path.join(VOCAB_DIR, 'packs.yml'), 'utf-8'), {
        version: '1.1',
    }) || []) as Array<Record<string, unknown>>;
    const rawUn = (parseYaml(
        fs.readFileSync(path.join(VOCAB_DIR, 'unassigned-artefacts.yml'), 'utf-8'),
        { version: '1.1' },
    ) || []) as Array<Record<string, unknown>>;
    const wsIds = new Set(ws.map((e) => e['id'] as string));
    const packIds = new Set(packs.map((e) => e['id'] as string));
    const quarantine = new Set(rawUn.map((e) => e['path'] as string));
    return [wsIds, packIds, quarantine];
}

/**
 * The four scan roots, named individually rather than via one container.
 *
 * ADR-051 did not move the pre-ADR-051 source container somewhere else — it
 * split it. `skills/` and `rules/` became top-level `src/` siblings, `templates/` went to
 * `src/agent-src/templates`, and `commands/` stopped being a directory at all
 * (each command is now `src/domains/<pack>/<subpath>/command.md`). Until
 * 2026-08-02 `SRC` still named the emptied container, so every walk below hit
 * a missing directory and the gate printed `0 artefact(s) clean` forever.
 *
 * Deliberately NOT the resolver's category-append view (`artefact_roots()`
 * + `/templates`): that also yields `src/templates`, an unrelated
 * consumer-scaffold tree this gate never scanned. Repairing a root must
 * restore the old scope, not silently widen it.
 */
function _scan_roots(): Array<[root: string, pattern: string]> {
    if (_paths_overridden()) {
        // Fixture mode — the injected container is the whole world.
        return [
            [path.join(SRC, 'skills'), 'SKILL.md'],
            [path.join(SRC, 'rules'), '*.md'],
            [path.join(SRC, 'commands'), '*.md'],
            [path.join(SRC, 'templates'), '*.md'],
        ];
    }
    return [
        [SRC_SKILLS(), 'SKILL.md'],
        [SRC_RULES(), '*.md'],
        [path.join(SRC_AGENT(), 'templates'), '*.md'],
    ];
}

function _iter_artefacts(): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (p: string): void => {
        if (!seen.has(p)) {
            seen.add(p);
            out.push(p);
        }
    };
    for (const [root, pattern] of _scan_roots()) {
        for (const p of _rglobSorted(root, pattern)) {
            push(p);
        }
    }
    if (!_paths_overridden()) {
        for (const p of iter_commands()) {
            push(p);
        }
    }
    return out;
}

/**
 * Does this frontmatter actually declare an ADR-013 discovery block?
 *
 * Used only by the quarantine-collision check ("listed as unassigned AND
 * declaring discovery metadata"). `workspaces`, `packs`, `lifecycle` and
 * `install` are unambiguous ADR-013 names, so their mere presence counts.
 *
 * `trust` is NOT unambiguous: it is also a scalar field in two unrelated
 * template schemas — `trust: durable` on a knowledge card and `trust: low` on a
 * Class-C lesson card. A bare `'trust' in fm` test read those as discovery
 * frontmatter and reported both quarantined templates as contradictions. They
 * are not: ADR-013 `trust` is an OBJECT (`{level, confidence,
 * human_review_required}`), a shape neither file has. So `trust` counts here
 * only when it is object-shaped. Across the whole quarantine list these two
 * strings were the only hits of any of the five names, so this is the complete
 * fix, not a special case for two paths.
 */
function _declares_discovery_frontmatter(fm: Record<string, unknown>): boolean {
    if (['workspaces', 'packs', 'lifecycle', 'install'].some((k) => k in fm)) {
        return true;
    }
    return 'trust' in fm && isPlainObject(fm['trust']);
}

function _check_one(
    p: string,
    wsIds: Set<string>,
    packIds: Set<string>,
    quarantine: Set<string>,
): string[] {
    const rel = _relPosix(p);
    const errs: string[] = [];
    if (quarantine.has(rel)) {
        const text = fs.readFileSync(p, 'utf-8');
        const [fm] = parse_frontmatter(text);
        if (isPlainObject(fm) && _declares_discovery_frontmatter(fm)) {
            errs.push(
                `${rel}: quarantined in unassigned-artefacts.yml but carries` +
                    ' discovery frontmatter — remove one or the other.',
            );
        }
        return errs;
    }

    const text = fs.readFileSync(p, 'utf-8');
    const [fm] = parse_frontmatter(text);
    if (!isPlainObject(fm)) {
        errs.push(`${rel}: missing or unparseable frontmatter`);
        return errs;
    }

    // Only the two keys that carry irreducible information are REQUIRED.
    //
    // ADR-013 Phase 4 read as "all five strictly enforced", and this gate was
    // written that way — but it never ran (dead scan root), while
    // `validate_frontmatter` DID run, green, for months against
    // skill.schema.json, whose `required` list is
    // ["name","description","source","domain"] and which gives `lifecycle`,
    // `trust` and `install` documented defaults ("active"; every `trust` and
    // `install` sub-property defaulted). Two gates asserted contradictory
    // contracts and only one was ever enforced — the enforced one is the real
    // contract. The corpus agrees and splits cleanly along exactly that line:
    // `workspaces`/`packs` are absent 0 times in 618 artefacts, while
    // lifecycle/trust/install are absent 574/459/456 times. A default cannot
    // invent which workspace or pack an artefact belongs to; it can supply the
    // other three. See the 2026-08-02 amendment in ADR-013.
    for (const key of ['workspaces', 'packs']) {
        if (!(key in fm)) {
            errs.push(`${rel}: missing required key \`${key}\``);
        }
    }
    if (errs.length) {
        return errs;
    }

    const ws = fm['workspaces'];
    if (!Array.isArray(ws) || ws.length === 0) {
        errs.push(`${rel}: workspaces must be a non-empty list`);
    } else {
        const bad = ws.filter((w) => !wsIds.has(w as string));
        if (bad.length) {
            errs.push(`${rel}: workspaces not in workspaces.yml: ${_pyRepr(bad)}`);
        }
    }

    const packs = fm['packs'];
    if (!Array.isArray(packs) || packs.length === 0) {
        errs.push(`${rel}: packs must be a non-empty list`);
    } else {
        const bad = packs.filter((p2) => !packIds.has(p2 as string));
        if (bad.length) {
            errs.push(`${rel}: packs not in packs.yml: ${_pyRepr(bad)}`);
        }
    }

    if ('pack' in fm) {
        const owner = fm['pack'];
        if (typeof owner !== 'string' || !packIds.has(owner)) {
            errs.push(`${rel}: pack \`${owner}\` not a known pack id in packs.yml`);
        }
    }

    // lifecycle / trust / install: schema-defaulted, so ABSENCE is legal at
    // BOTH levels — a missing key and a missing sub-key alike take the
    // documented default. Anything actually written down is still fully
    // validated; this narrows WHEN the checks fire, never what they accept.
    //
    // The sub-key half matters as much as the top-level half: an earlier pass
    // defaulted an absent `trust` but still demanded all three sub-keys of a
    // `trust:` block that was present, which is self-contradictory — the same
    // default was honoured in one branch and refused in the other. It also had
    // no basis in the corpus: across 288 skills, `trust` is complete 0 times,
    // partial 120, absent 168. A required shape with 0/288 adoption was never
    // the real requirement. `validate_frontmatter` — the gate that has actually
    // been running — agrees: `apply_schema_defaults` fills missing sub-keys
    // from the schema before validating, which is why it reports 0 failing on
    // this same tree.
    if ('lifecycle' in fm) {
        const lc = fm['lifecycle'];
        if (typeof lc !== 'string' || !LIFECYCLES.has(lc)) {
            errs.push(`${rel}: lifecycle \`${lc}\` not in ${_sortedListRepr(LIFECYCLES)}`);
        }
    }

    const trust = fm['trust'];
    if (!('trust' in fm)) {
        // schema default: {level: core, confidence: high, human_review_required: false}
    } else if (!isPlainObject(trust)) {
        errs.push(`${rel}: trust must be a mapping`);
    } else {
        const t = trust as Record<string, unknown>;
        if ('level' in t) {
            const level = t['level'];
            if (typeof level !== 'string' || !TRUST_LEVELS.has(level)) {
                errs.push(
                    `${rel}: trust.level \`${_unwrap(level)}\` not in ${_sortedListRepr(TRUST_LEVELS)}`,
                );
            }
        }
        if ('confidence' in t) {
            const confidence = t['confidence'];
            if (typeof confidence !== 'string' || !TRUST_CONFIDENCE.has(confidence)) {
                errs.push(
                    `${rel}: trust.confidence \`${_unwrap(confidence)}\` not in` +
                        ` ${_sortedListRepr(TRUST_CONFIDENCE)}`,
                );
            }
        }
        if ('human_review_required' in t) {
            if (typeof t['human_review_required'] !== 'boolean') {
                errs.push(`${rel}: trust.human_review_required must be bool`);
            }
        }
    }

    const install = fm['install'];
    if (!('install' in fm)) {
        // schema default: {default: true, removable: false}
    } else if (!isPlainObject(install)) {
        errs.push(`${rel}: install must be a mapping`);
    } else {
        const i = install as Record<string, unknown>;
        if ('default' in i && typeof i['default'] !== 'boolean') {
            errs.push(`${rel}: install.default must be bool`);
        }
        if ('removable' in i && typeof i['removable'] !== 'boolean') {
            errs.push(`${rel}: install.removable must be bool`);
        }
    }
    return errs;
}

interface Args {
    quiet: boolean;
}

function parse_args(argv: readonly string[]): Args {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_artefact_frontmatter [-h] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(`lint_artefact_frontmatter: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
    return { quiet };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const [wsIds, packIds, quarantine] = _load_vocab();
    const artefacts = _iter_artefacts();
    // Scope assertion: 0 artefacts means every root moved, not that the tree
    // is clean. That was this gate's shipped state until 2026-08-02.
    try {
        assertScanned({
            gate: 'lint_artefact_frontmatter',
            scanned: artefacts.length,
            units: 'artefact(s)',
            roots: _scan_roots().map(([r]) => _relPosix(r) || '.'),
        });
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) {
            throw exc;
        }
        process.stderr.write(`❌  ${exc.message}\n`);
        return 2;
    }
    // Gate-coverage contract (src/config/gate-coverage.yml rule 1): publish the
    // asserted count machine-readably, before the verdict branches, so a run
    // that finds errors still reports the corpus it read.
    process.stdout.write(`scanned: ${String(artefacts.length)}\n`);
    const allErrs: string[] = [];
    for (const p of artefacts) {
        allErrs.push(..._check_one(p, wsIds, packIds, quarantine));
    }

    if (allErrs.length) {
        for (const e of allErrs) {
            process.stderr.write(`ERROR: ${e}\n`);
        }
        process.stderr.write(
            `\n${allErrs.length} violation(s) across ${artefacts.length} artefact(s).\n`,
        );
        if (!_paths_overridden()) {
            const verdict = checkRatchet({
                gate: 'lint_artefact_frontmatter',
                actual: allErrs.length,
                repoRoot: ROOT,
            });
            if (verdict.ok) {
                process.stdout.write(`⚠️   ${verdict.message}\n`);
                return 0;
            }
            process.stderr.write(`❌  ${verdict.message}\n`);
        }
        return 1;
    }
    if (!args.quiet) {
        process.stdout.write(
            `✅  lint-artefact-frontmatter: ${artefacts.length} artefact(s) clean` +
                ` (quarantine: ${quarantine.size}).\n`,
        );
    }
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

/** Recursive glob matching `Path.rglob(pattern)`, returned sorted by full path. */
function _rglobSorted(root: string, pattern: string): string[] {
    const out: string[] = [];
    const matchExt = pattern === '*.md' ? '.md' : null;
    const matchExact = pattern === 'SKILL.md' ? 'SKILL.md' : null;
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
            } else if (e.isFile()) {
                if (matchExact !== null && e.name === matchExact) {
                    out.push(full);
                } else if (matchExt !== null && e.name.endsWith(matchExt)) {
                    out.push(full);
                }
            }
        }
    };
    if (_exists(root)) {
        walk(root);
    }
    return out.sort();
}

function _relPosix(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Render a value the way Python embeds it in `\`${value}\`` — None for null. */
function _unwrap(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    return String(v);
}

/** Mirror Python list repr of strings: ['a', 'b']. */
function _pyRepr(arr: unknown[]): string {
    return '[' + arr.map((x) => _pyReprScalar(x)).join(', ') + ']';
}

function _pyReprScalar(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    if (typeof v === 'number') {
        return String(v);
    }
    if (typeof v === 'string') {
        return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return String(v);
}

/** Mirror Python `sorted(set)` repr as a list literal of single-quoted strings. */
function _sortedListRepr(s: Set<string>): string {
    return '[' + [...s].sort().map((x) => `'${x}'`).join(', ') + ']';
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
    LIFECYCLES,
    TRUST_LEVELS,
    TRUST_CONFIDENCE,
    _set_paths,
    _load_vocab,
    _iter_artefacts,
    _check_one,
    parse_args,
    main,
};
