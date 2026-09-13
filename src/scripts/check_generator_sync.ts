#!/usr/bin/env tsx
/**
 * Refuse a push whose diff edits the SOURCE of a tracked generated artefact
 * without re-running that artefact's generator.
 *
 * WHY THIS EXISTS — three incidents, one day, one class.
 *
 * On 2026-09-12, in a single autonomous drain run, the same defect shipped
 * three times:
 *
 *   1. `ADR-118` gained a `review_trigger` in its body. The committed ADR
 *      evidence census (the `adr-evidence-census` triple below) pins a line
 *      offset into every ADR, so it went stale. CI caught it after the push.
 *   2. The same thing on the next branch — `ADR-134` gained two body blocks,
 *      census stale again. The first fix had been written as a one-off rather
 *      than as a pattern, so the second occurrence was free.
 *   3. `src/server/schemas/settings.ts` had two description strings rewritten.
 *      `dist/install/install.mjs` is a committed esbuild bundle over that
 *      module and was not rebuilt. FOUR CI jobs went red on the one cause.
 *
 * Each artefact already had a gate. Both gates run only in CI, so each cost a
 * red run and a fixup push. This gate moves the same question before the push,
 * and generalises it: a registry of {source, generator, output} triples, each
 * checked only when THIS branch touched its source.
 *
 * DIFF-SCOPED, AND THAT IS A DESIGN CONSTRAINT RATHER THAN AN OPTIMISATION.
 * A gate that re-ran every generator on every push would cost more than the
 * failure it prevents, and a pre-push gate people skip is worse than no gate —
 * a fact this repository has recorded more than once. So a triple whose source
 * this branch did not touch is not checked, and the run says so.
 *
 * FAIL CLOSED, ALWAYS. Every input this gate cannot read is a non-zero exit,
 * never a green: an unresolvable base ref, a generator that fails, an output
 * that cannot be read, a source set that cannot be derived. A gate that exits 0
 * on a measurement it could not take is the precise failure mode it exists to
 * prevent.
 *
 * THE POISONED-REGENERATION PROBLEM, AND WHY THIS GATE NORMALISES
 *
 * `node_modules` in a `.claude/worktrees/` checkout of this repository is a
 * SYMLINK to the parent checkout. esbuild resolves each bundled module
 * relative to the outfile and bakes the result into its per-module boundary
 * comments and its CommonJS registry keys, so a bundle built in a worktree
 * carries `../../../node_modules/yaml/...` where a bundle built in the main
 * checkout carries `node_modules/yaml/...`. Measured on this tree: 189 such
 * lines, deterministic across runs.
 *
 * Two consequences, and they pull in opposite directions:
 *
 *   - A naive regenerate-and-diff would report the install bundle permanently
 *     stale in every worktree — a false red, which teaches people to skip.
 *   - Telling someone to run `npm run build:install-bundle` from a worktree
 *     would have them COMMIT those 189 lines, breaking module resolution for
 *     every consumer installing from the package. That near-miss was real and
 *     was caught only by reading the diff before committing.
 *
 * So this gate does both halves. It DETECTS the ascent in its own regenerated
 * output; where detected it cancels it for the comparison (an exact, bounded
 * rewrite of `(../)+node_modules/` to `node_modules/` and nothing else), and
 * it rewrites the remedy it prints so the advice is safe from where the
 * contributor actually is. Proven rather than argued: with the cancellation
 * applied, a worktree build of the current tree is byte-identical to the
 * committed bundle, and a one-character source edit still reds.
 *
 * The cancellation is narrow on purpose. It only ever removes `../` hops
 * immediately preceding `node_modules/`; no real content change has that
 * shape. And it protects only the side this gate BUILDS — the committed
 * bundle is never rewritten, and an ascent inside it stays a finding for
 * `check_bundle_path_leakage`, which owns that invariant and runs in the same
 * preflight chain.
 *
 * Usage:
 *     tsx src/scripts/check_generator_sync.ts
 *     tsx src/scripts/check_generator_sync.ts --quiet
 *     tsx src/scripts/check_generator_sync.ts --base <ref>
 *     tsx src/scripts/check_generator_sync.ts --self-test
 *
 * Exit codes: 0 = every in-scope output matches a fresh run · 1 = a stale
 * output, or an input this gate could not read · 2 = usage error.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Single-quoted on purpose: check_gate_completeness detects ledger adoption by this exact import form.
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { resolveBaseRef } from './_lib/ratchet_base_ref.js';
import { reportScanned } from './_lib/scan_scope.js';

const GATE = 'check_generator_sync';
const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/**
 * A `../`-ascent reaching `node_modules/`, however many hops.
 *
 * The same shape `check_bundle_path_leakage` calls `parent-relative-node-modules`.
 * It is re-expressed here rather than imported because the two gates apply it to
 * different populations — that gate to the COMMITTED artefact, this one to its
 * own freshly built comparison copy — and coupling them would make a scope
 * change to either silently change the other.
 */
const PARENT_ASCENT_TO_NODE_MODULES = /(?:\.\.\/)+node_modules\//g;

/** One source the registry watches, and how a changed path is matched to it. */
export interface SourceMatcher {
    /** `prefix` — any path under it. `file` — that exact path. */
    readonly kind: 'prefix' | 'file';
    /** Repo-relative, `/`-separated (git's own output format on every platform). */
    readonly value: string;
}

/** A regeneration that could not be performed — never a pass. */
export interface Unmeasurable {
    readonly ok: false;
    readonly reason: string;
}

export interface Regenerated {
    readonly ok: true;
    /** The freshly generated bytes, before normalisation. */
    readonly text: string;
}

export interface Triple {
    /** Stable id — the ledger target and the failure heading. */
    readonly id: string;
    /** Repo-relative path of the committed generated artefact. */
    readonly output: string;
    /** The exact command a human runs to fix a red. Printed verbatim. */
    readonly remedy: string;
    /** One line naming why the output depends on the sources, for the report. */
    readonly why: string;
    /**
     * Which changed paths put this triple in scope.
     *
     * Returns an {@link Unmeasurable} rather than an empty list when the source
     * set cannot be determined: an empty list would silently put the triple out
     * of scope, which is the one way this gate could pass without measuring.
     */
    sourcesOf(root: string): { ok: true; sources: SourceMatcher[] } | Unmeasurable;
    /** Regenerate into a temp dir this gate owns. Never writes into the tree. */
    regenerate(root: string, workDir: string): Regenerated | Unmeasurable;
    /**
     * Cancel known environment artefacts before comparing, and report whether
     * any were found so the remedy can be adjusted. Applied ONLY to the freshly
     * built side.
     */
    normalise?(text: string): { text: string; environmentArtefacts: number };
    /** Remedy override when {@link normalise} found environment artefacts. */
    poisonedRemedy?: string;
}

function _git(root: string, args: readonly string[]): string {
    return execFileSync('git', [...args], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
}

/**
 * Repo-relative paths this branch changed against `baseRef`, plus anything
 * uncommitted.
 *
 * The working tree is included deliberately. This gate's whole subject is the
 * window before a commit reaches a remote, and an edit that is staged but not
 * yet committed is exactly the state in which incidents 1-3 were made.
 */
export function changedPaths(root: string, baseRef: string): string[] {
    const out = new Set<string>();
    const add = (raw: string): void => {
        for (const line of raw.split('\n')) {
            const p = line.trim();
            if (p !== '') out.add(p);
        }
    };
    add(_git(root, ['diff', '--name-only', `${baseRef}...HEAD`]));
    add(_git(root, ['diff', '--name-only', 'HEAD']));
    add(_git(root, ['diff', '--name-only', '--cached']));
    add(_git(root, ['ls-files', '--others', '--exclude-standard']));
    return [...out].sort();
}

/** Does any changed path match any of this triple's sources? */
export function matchedSources(
    changed: readonly string[],
    sources: readonly SourceMatcher[],
): string[] {
    const hits: string[] = [];
    for (const c of changed) {
        for (const s of sources) {
            const hit = s.kind === 'file' ? c === s.value : c.startsWith(s.value);
            if (hit) {
                hits.push(c);
                break;
            }
        }
    }
    return hits;
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * Every bundled ES module esbuild recorded in an install-bundle build.
 *
 * Derived from the committed bundle's own per-module boundary comments rather
 * than from a hand-maintained import list, so the source set cannot drift from
 * what the bundle actually contains. A NEW import is still covered: the module
 * that added it is itself in the list, so its edit puts the triple in scope and
 * the rebuilt bundle then carries the new module.
 */
export function bundledInstallSources(bundleText: string): string[] {
    const out = new Set<string>();
    for (const line of bundleText.split('\n')) {
        const m = /^\/\/ (src\/[^\s]+)$/.exec(line.trim());
        if (m !== null) out.add(m[1] as string);
    }
    return [...out].sort();
}

const INSTALL_BUNDLE = 'dist/install/install.mjs';

const INSTALL_BUNDLE_TRIPLE: Triple = {
    id: 'install-bundle',
    output: INSTALL_BUNDLE,
    remedy: 'npm run build:install-bundle',
    why: 'a committed esbuild bundle over src/scripts/install.ts and everything it imports',
    poisonedRemedy:
        'run `npm run build:install-bundle` from the MAIN CHECKOUT, not from this worktree — ' +
        "a worktree's node_modules is a symlink and esbuild bakes `../../../node_modules/...` " +
        'into the bundle (189 lines measured), which breaks module resolution for every consumer',
    sourcesOf(root) {
        const abs = path.join(root, INSTALL_BUNDLE);
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf8');
        } catch (e) {
            return {
                ok: false,
                reason:
                    `cannot read ${INSTALL_BUNDLE} to derive its bundled source set (${String(e)}). ` +
                    'The source set is read from the bundle itself, so an unreadable bundle means ' +
                    'this gate cannot tell whether the branch touched a source — which is a ' +
                    'refusal, not a pass.',
            };
        }
        const mods = bundledInstallSources(text);
        if (mods.length === 0) {
            return {
                ok: false,
                reason:
                    `${INSTALL_BUNDLE} carries no \`// src/...\` module boundary comments. Either the ` +
                    'bundle is not an esbuild output any more, or the comment format changed — ' +
                    'either way the derived source set would be empty and every edit would read ' +
                    'as out of scope.',
            };
        }
        return {
            ok: true,
            sources: mods.map((value) => ({ kind: 'file', value }) as const),
        };
    },
    regenerate(root, workDir) {
        const outFile = path.join(workDir, 'install.mjs');
        const esbuild = path.join(
            root,
            'node_modules',
            '.bin',
            process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild',
        );
        if (!fs.existsSync(esbuild)) {
            return {
                ok: false,
                reason: `no esbuild at ${path.relative(root, esbuild)} — run \`npm ci\` before this gate`,
            };
        }
        // Argv kept in lockstep with package.json `build:install-bundle`; the
        // only difference is --outfile, which points at this gate's temp dir so
        // the tree is never written to.
        const res = spawnSync(
            esbuild,
            [
                'src/scripts/install.ts',
                '--bundle',
                '--platform=node',
                '--format=esm',
                '--target=node20',
                '--define:__AGENT_CONFIG_BUNDLE__=true',
                `--outfile=${outFile}`,
                "--banner:js=import { createRequire as __acCreateRequire } from 'node:module'; const require = globalThis.require ?? __acCreateRequire(import.meta.url);",
            ],
            { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
        );
        if (res.status !== 0) {
            return {
                ok: false,
                reason: `esbuild exited ${String(res.status)}: ${(res.stderr ?? '').trim()}`,
            };
        }
        try {
            return { ok: true, text: fs.readFileSync(outFile, 'utf8') };
        } catch (e) {
            return {
                ok: false,
                reason: `esbuild reported success but wrote no readable outfile (${String(e)})`,
            };
        }
    },
    normalise(text) {
        const environmentArtefacts = (text.match(PARENT_ASCENT_TO_NODE_MODULES) ?? []).length;
        return {
            text: text.replace(PARENT_ASCENT_TO_NODE_MODULES, 'node_modules/'),
            environmentArtefacts,
        };
    },
};

const CENSUS_TRIPLE: Triple = {
    id: 'adr-evidence-census',
    output: 'agents/evidence/analysis/adr-evidence-census-2026-08.md',
    remedy: './scripts-run src/scripts/adr/evidence_census',
    why: 'the census pins a line offset into every ADR, so any body edit moves the offsets below it',
    sourcesOf() {
        return {
            ok: true,
            sources: [
                { kind: 'prefix', value: 'docs/decisions/' },
                { kind: 'prefix', value: 'docs/adrs/' },
            ],
        };
    },
    regenerate(root, workDir) {
        const outFile = path.join(workDir, 'census.md');
        const tsx = path.join(
            root,
            'node_modules',
            '.bin',
            process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
        );
        if (!fs.existsSync(tsx)) {
            return {
                ok: false,
                reason: `no tsx at ${path.relative(root, tsx)} — run \`npm ci\` before this gate`,
            };
        }
        const res = spawnSync(
            tsx,
            [path.join(root, 'src', 'scripts', 'adr', 'evidence_census.ts'), '--out', outFile],
            { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
        );
        if (res.status !== 0) {
            return {
                ok: false,
                reason: `evidence_census exited ${String(res.status)}: ${(res.stderr ?? '').trim()}`,
            };
        }
        try {
            return { ok: true, text: fs.readFileSync(outFile, 'utf8') };
        } catch (e) {
            return {
                ok: false,
                reason: `evidence_census reported success but wrote no readable file (${String(e)})`,
            };
        }
    },
};

export const REGISTRY: readonly Triple[] = [CENSUS_TRIPLE, INSTALL_BUNDLE_TRIPLE];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export interface RunOptions {
    repoRoot?: string;
    baseRef?: string | null;
    quiet?: boolean;
    registry?: readonly Triple[];
    write?: (chunk: string) => unknown;
}

function firstLineDiff(committed: string, fresh: string): string {
    const a = committed.split('\n');
    const b = fresh.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        if (a[i] !== b[i]) {
            return (
                `    first difference at line ${String(i + 1)}\n` +
                `      committed: ${JSON.stringify((a[i] ?? '<end of file>').slice(0, 160))}\n` +
                `      fresh run: ${JSON.stringify((b[i] ?? '<end of file>').slice(0, 160))}\n`
            );
        }
    }
    return '    (the two differ only in trailing bytes)\n';
}

export function run(opts: RunOptions = {}): number {
    const root = opts.repoRoot ?? REPO_ROOT;
    const quiet = opts.quiet ?? false;
    const registry = opts.registry ?? REGISTRY;
    const write = opts.write ?? process.stdout.write.bind(process.stdout);

    const baseRef = opts.baseRef === undefined ? resolveBaseRef(root) : opts.baseRef;
    if (baseRef === null || baseRef === '') {
        write(
            `❌  ${GATE}: no base ref resolved — pass --base <ref> or set RATCHET_BASE_REF.\n` +
                '    Comparing against an assumed-empty base would put every triple out of scope ' +
                'and pass by measuring nothing.\n',
        );
        return 1;
    }

    let changed: string[];
    try {
        changed = changedPaths(root, baseRef);
    } catch (e) {
        write(`❌  ${GATE}: cannot diff against ${baseRef} — ${String(e)}\n`);
        return 1;
    }

    const ledger = new GateLedger(GATE);
    ledger.plan(registry.map((t) => t.id));

    const failures: string[] = [];
    let inScope = 0;

    for (const triple of registry) {
        const sources = triple.sourcesOf(root);
        if (!sources.ok) {
            // An undeterminable source set is a refusal. Skipping here would be
            // the silent pass this gate exists to make impossible.
            ledger.fail(triple.id, sources.reason);
            failures.push(`${triple.id}: UNMEASURABLE — ${sources.reason}`);
            continue;
        }

        const hits = matchedSources(changed, sources.sources);
        if (hits.length === 0) {
            ledger.skip(triple.id, 'no_applicable_files');
            continue;
        }
        inScope += 1;

        const workDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'gensync-'));
        try {
            const outAbs = path.join(root, triple.output);
            let committed: string;
            try {
                committed = fs.readFileSync(outAbs, 'utf8');
            } catch (e) {
                ledger.fail(triple.id, 'committed output unreadable');
                failures.push(
                    `${triple.id}: UNMEASURABLE — cannot read the committed output ${triple.output} ` +
                        `(${String(e)}). A generated artefact its own gate cannot open is a refusal, ` +
                        'not an absence.',
                );
                continue;
            }

            const fresh = triple.regenerate(root, workDir);
            if (!fresh.ok) {
                ledger.fail(triple.id, 'generator failed');
                failures.push(
                    `${triple.id}: UNMEASURABLE — the generator did not run: ${fresh.reason}`,
                );
                continue;
            }

            const norm = triple.normalise?.(fresh.text) ?? {
                text: fresh.text,
                environmentArtefacts: 0,
            };
            const poisoned = norm.environmentArtefacts > 0;

            if (norm.text === committed) {
                ledger.complete(triple.id);
                if (!quiet) {
                    write(
                        `✅  ${triple.id}: ${String(hits.length)} source(s) changed, ${triple.output} ` +
                            `matches a fresh run` +
                            (poisoned
                                ? ` (${String(norm.environmentArtefacts)} environment path artefact(s) cancelled)`
                                : '') +
                            '\n',
                    );
                }
                continue;
            }

            ledger.fail(triple.id, 'output is stale against its source');
            const remedy =
                poisoned && triple.poisonedRemedy !== undefined ? triple.poisonedRemedy : triple.remedy;
            failures.push(
                `${triple.id}: ${triple.output} is STALE.\n` +
                    `    ${triple.why}\n` +
                    `    ${String(hits.length)} source(s) changed on this branch, e.g. ${hits.slice(0, 3).join(', ')}\n` +
                    firstLineDiff(committed, norm.text) +
                    `    REGENERATE:  ${remedy}\n` +
                    (poisoned
                        ? `    NOTE: this build environment injected ${String(norm.environmentArtefacts)} ` +
                          '`../.../node_modules/` path(s); they were cancelled for the comparison ' +
                          'above, but a rebuild committed from HERE would carry them.\n'
                        : ''),
            );
        } finally {
            fs.rmSync(workDir, { recursive: true, force: true });
        }
    }

    ledger.report();

    // Diff-scoped: zero in-scope triples is the ordinary case and IS the pass —
    // but it is announced rather than printed as a bare green, because a silent
    // green over an empty set is indistinguishable from a gate that stopped
    // resolving its registry.
    reportScanned({
        gate: GATE,
        scanned: inScope,
        units: 'generated artefact(s) whose source this branch touched',
        roots: registry.map((t) => t.output),
        allowEmpty:
            'EMPTY_VALID: the scope is the set of registry triples whose SOURCE changed since the ' +
            'base ref; a branch touching none has no generator to re-run, and zero is the pass. ' +
            'The registry itself is never empty — an unresolvable triple fails rather than skips.',
    });

    if (failures.length > 0) {
        write(
            `❌  ${GATE}: ${String(failures.length)} generated artefact(s) out of sync with their source.\n\n`,
        );
        for (const f of failures) write(`  - ${f}\n`);
        write(
            '\n    Each of these has a CI gate that would catch it after the push. This one is ' +
                'before it.\n',
        );
        return 1;
    }

    if (!quiet) {
        if (inScope === 0) {
            write(
                `✅  ${GATE}: no registry source changed since ${baseRef} — ` +
                    `${String(registry.length)} triple(s) out of scope, nothing to regenerate\n`,
            );
        } else {
            write(`✅  ${GATE}: ${String(inScope)} in-scope generated artefact(s) match a fresh run\n`);
        }
    }
    return 0;
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

function _mkGitRepo(dir: string): string {
    const g = (args: string[]): void => {
        spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    };
    g(['init', '-q']);
    g(['config', 'user.email', 'g@example.com']);
    g(['config', 'user.name', 'g']);
    g(['add', '-A']);
    g(['commit', '-qm', 'base', '--allow-empty']);
    return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
}

/**
 * A self-contained triple over a trivial generator: `out.txt` must equal
 * `src/in.txt` uppercased. Small enough that each case isolates exactly one
 * property of the gate rather than a property of esbuild.
 */
function _fixtureTriple(over: Partial<Triple> = {}): Triple {
    return {
        id: 'fixture',
        output: 'out.txt',
        remedy: 'fixture-regen',
        why: 'out.txt is in.txt uppercased',
        sourcesOf: () => ({ ok: true, sources: [{ kind: 'file', value: 'src/in.txt' }] }),
        regenerate: (root) => {
            try {
                return {
                    ok: true,
                    text: fs.readFileSync(path.join(root, 'src', 'in.txt'), 'utf8').toUpperCase(),
                };
            } catch (e) {
                return { ok: false, reason: String(e) };
            }
        },
        ...over,
    };
}

/** A repo whose `src/in.txt` is UNTRACKED, so it is inside the changed set. */
function _fixtureRepo(inText: string, outText: string): { dir: string; base: string } {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'gensync-st-'));
    const base = _mkGitRepo(dir);
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'in.txt'), inText);
    fs.writeFileSync(path.join(dir, 'out.txt'), outText);
    return { dir, base };
}

const _poisonNormalise = (text: string): { text: string; environmentArtefacts: number } => ({
    text: text.replace(PARENT_ASCENT_TO_NODE_MODULES, 'node_modules/'),
    environmentArtefacts: (text.match(PARENT_ASCENT_TO_NODE_MODULES) ?? []).length,
});

function selfTest(): number {
    const silent = (): void => {};
    const cases: SelfTestCase[] = [
        {
            name: 'source changed, output NOT regenerated → reject',
            expect: 'reject',
            run: () => {
                const { dir, base } = _fixtureRepo('hello\n', 'STALE\n');
                return run({
                    repoRoot: dir,
                    baseRef: base,
                    quiet: true,
                    registry: [_fixtureTriple()],
                    write: silent,
                });
            },
        },
        {
            name: 'source changed AND output correctly regenerated → accept (the false-positive case)',
            expect: 'accept',
            run: () => {
                const { dir, base } = _fixtureRepo('hello\n', 'HELLO\n');
                return run({
                    repoRoot: dir,
                    baseRef: base,
                    quiet: true,
                    registry: [_fixtureTriple()],
                    write: silent,
                });
            },
        },
        {
            name: 'output stale but NO source changed → accept (diff-scoping holds)',
            expect: 'accept',
            run: () => {
                // Both files are committed at base, so neither is in the changed
                // set; only an unrelated file moved. The stale `out.txt` must not
                // be reported — a gate that ignored scope would red here.
                const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'gensync-st-'));
                fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
                fs.writeFileSync(path.join(dir, 'src', 'in.txt'), 'hello\n');
                fs.writeFileSync(path.join(dir, 'out.txt'), 'STALE\n');
                const base = _mkGitRepo(dir);
                fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'x\n');
                return run({
                    repoRoot: dir,
                    baseRef: base,
                    quiet: true,
                    registry: [_fixtureTriple()],
                    write: silent,
                });
            },
        },
        {
            name: 'source set undeterminable → reject, never a silent out-of-scope pass',
            expect: 'reject',
            run: () => {
                const { dir, base } = _fixtureRepo('hello\n', 'HELLO\n');
                return run({
                    repoRoot: dir,
                    baseRef: base,
                    quiet: true,
                    registry: [
                        _fixtureTriple({
                            sourcesOf: () => ({ ok: false, reason: 'cannot derive the source set' }),
                        }),
                    ],
                    write: silent,
                });
            },
        },
        {
            name: 'generator fails → reject (an unrunnable generator is not a fresh output)',
            expect: 'reject',
            run: () => {
                const { dir, base } = _fixtureRepo('hello\n', 'HELLO\n');
                return run({
                    repoRoot: dir,
                    baseRef: base,
                    quiet: true,
                    registry: [_fixtureTriple({ regenerate: () => ({ ok: false, reason: 'boom' }) })],
                    write: silent,
                });
            },
        },
        {
            name: 'committed output missing → reject (unreadable input is never a pass)',
            expect: 'reject',
            run: () => {
                const { dir, base } = _fixtureRepo('hello\n', 'HELLO\n');
                fs.rmSync(path.join(dir, 'out.txt'));
                return run({
                    repoRoot: dir,
                    baseRef: base,
                    quiet: true,
                    registry: [_fixtureTriple()],
                    write: silent,
                });
            },
        },
        {
            name: 'unresolvable base ref → reject',
            expect: 'reject',
            run: () => {
                const { dir } = _fixtureRepo('hello\n', 'HELLO\n');
                return run({
                    repoRoot: dir,
                    baseRef: null,
                    quiet: true,
                    registry: [_fixtureTriple()],
                    write: silent,
                });
            },
        },
        {
            name: 'environment-poisoned regeneration is cancelled, not reported stale → accept',
            expect: 'accept',
            run: () => {
                const { dir, base } = _fixtureRepo('x\n', 'node_modules/yaml/x.js\n');
                return run({
                    repoRoot: dir,
                    baseRef: base,
                    quiet: true,
                    registry: [
                        _fixtureTriple({
                            regenerate: () => ({ ok: true, text: '../../../node_modules/yaml/x.js\n' }),
                            normalise: _poisonNormalise,
                        }),
                    ],
                    write: silent,
                });
            },
        },
        {
            name: 'a REAL staleness still reds THROUGH the poison cancellation → reject',
            expect: 'reject',
            run: () => {
                // The cancellation must not become a blanket excuse: the fresh
                // side carries both the environment ascent AND a genuine content
                // change, and only the former may be absorbed.
                const { dir, base } = _fixtureRepo('x\n', 'node_modules/yaml/x.js\nOLD\n');
                return run({
                    repoRoot: dir,
                    baseRef: base,
                    quiet: true,
                    registry: [
                        _fixtureTriple({
                            regenerate: () => ({
                                ok: true,
                                text: '../../../node_modules/yaml/x.js\nNEW\n',
                            }),
                            normalise: _poisonNormalise,
                        }),
                    ],
                    write: silent,
                });
            },
        },
        {
            name: 'the shipped registry against this tree → accept',
            expect: 'accept',
            run: () => runGateCli(REPO_ROOT, 'src/scripts/check_generator_sync.ts', ['--quiet'], REPO_ROOT),
        },
    ];
    return runSelfTest({ gate: GATE, cases, minCases: 10, minRejectCases: 6 });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE =
    `usage: ${GATE} [--base <ref>] [--quiet] [--self-test] [-h|--help]\n` +
    '  Refuses when a tracked generated artefact is stale against a source this\n' +
    '  branch touched. Diff-scoped; fails closed on any input it cannot read.\n';

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let base: string | undefined;
    let quiet = false;

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--self-test') {
            // Guarded so a fixture invocation cannot recurse into its own suite.
            if (process.env['GATE_SELF_TEST_CHILD'] === '1') {
                process.stderr.write(`${GATE}: --self-test is not re-entrant\n`);
                return 2;
            }
            return selfTest();
        } else if (a === '--quiet') {
            quiet = true;
        } else if (a === '--base') {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith('--')) {
                process.stderr.write(`${GATE}: --base needs a ref\n${USAGE}`);
                return 2;
            }
            base = v;
            i += 1;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            return 0;
        } else {
            // Refuse rather than ignore. A gate in a required job that silently
            // accepts a mistyped flag hands back a green nobody earned.
            process.stderr.write(`${GATE}: unknown argument ${a}\n${USAGE}`);
            return 2;
        }
    }

    return run({ quiet, ...(base !== undefined ? { baseRef: base } : {}) });
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
