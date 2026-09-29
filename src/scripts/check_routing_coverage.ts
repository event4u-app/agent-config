#!/usr/bin/env tsx
/**
 * `check_routing_coverage` — two coverage ratchets, one per routed scope.
 *
 * `road-to-routing-assurance` Phase 0.3. Coverage ratio = corpus cases / routed
 * units, per scope, seeded at the measured current value. **CI fails only on a
 * DECREASE** — the same COUNT-ratchet disposition `lint_trigger_precision.ts`
 * already uses, and for the same reason: the number is a property of the estate,
 * so a rise is somebody's work and a fall is somebody's omission.
 *
 * TWO scopes, never one aggregate, because the aggregate hides the finding:
 *
 *   rules  94 / 105 = 0.895   deterministic corpus, gating
 *   skills 76 / 299 = 0.254   advisory live harness only
 *
 * The rules surface is ~90 % covered by a corpus that can fail a PR. The skills
 * surface — the one production actually routes on — is 25 %, covered only by a
 * harness that is "advisory only, never gating" (`rule_trigger_eval.ts:4`). One
 * blended figure would read as ~46 % and describe neither.
 *
 * WHY A RATIO AND NOT A COUNT: the denominator moves. Adding 8 skills without
 * adding corpus cases lowers coverage while every count rises, and a count
 * ratchet would call that progress.
 *
 * THE THIRD SCOPE, ADDED BY `road-to-a-menu-whose-precision-is-measured` 2.1.
 * The two ratios above are estate-wide and therefore patient: a contributor can
 * edit a corpus-less skill for a year without either ratio moving, because the
 * numerator and the denominator both stay put. `touched` closes that on the one
 * occasion where the cost of writing a corpus is lowest — the author already has
 * the skill open. A skill CHANGED by the diff must carry `evals/triggers.json`.
 *
 * It is deliberately not a fourth ratio. A ratio over a diff is meaningless when
 * the diff touches one skill, and the obligation here is per skill rather than
 * per estate: one uncovered touched skill is one failure, whatever the estate
 * average says.
 *
 * Exit codes: 0 = at or above seed and no uncovered touched skill · 1 = a scope
 * fell or a touched skill has no corpus · 2 = dead scope.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { type SelfTestCase, runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { gitEnv } from './_lib/git_env.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = fileURLToPath(import.meta.url);
const REAL_REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..');
/**
 * Scan root. The env override exists for `--self-test`, which drives the REAL
 * CLI against a synthetic tree — an in-process call would skip the argv parsing
 * and the entry guard, and a gate resolving its root from `import.meta.url`
 * reads the live checkout whatever the cwd, so every fixture would be green for
 * the wrong reason.
 */
const REPO_ROOT = process.env['CHECK_ROUTING_COVERAGE_ROOT'] ?? REAL_REPO_ROOT;
export const SEED_REL = 'src/config/routing-coverage-seed.json';

export type Scope = 'rules' | 'skills';

export interface ScopeReading {
    scope: Scope;
    cases: number;
    units: number;
    ratio: number;
}

export interface Seed {
    rules: number;
    skills: number;
}

/** Routed rules = every tier-1 and tier-2 entry in the compiled router. */
export function measureRules(root: string): ScopeReading {
    const routerPath = path.join(root, 'dist', 'router.json');
    let doc: { tier_1?: { id: string }[]; tier_2?: { id: string }[] };
    try {
        doc = JSON.parse(fs.readFileSync(routerPath, 'utf-8')) as typeof doc;
    } catch {
        throw new DeadScopeError(
            'check_routing_coverage',
            'dist/router.json is unreadable — the routed-rule denominator cannot be measured, ' +
                'and a missing router is not a coverage of zero.',
        );
    }
    const ids = new Set([...(doc.tier_1 ?? []), ...(doc.tier_2 ?? [])].map((r) => r.id));
    const dir = path.join(root, 'tests', 'eval', 'routing-matrix');
    let files: string[];
    try {
        files = fs.readdirSync(dir);
    } catch {
        files = [];
    }
    const stems = new Set(
        files.filter((f) => /\.ya?ml$/.test(f)).map((f) => f.replace(/\.ya?ml$/, '')),
    );
    // Intersection, not the file count: a fixture naming no routed rule covers
    // nothing, and counting it would let the ratio rise on dead files.
    let covered = 0;
    for (const s of stems) if (ids.has(s)) covered += 1;
    return { scope: 'rules', cases: covered, units: ids.size, ratio: ids.size === 0 ? 0 : covered / ids.size };
}

/** Routed skills = every SKILL.md; a case = that skill's `evals/triggers.json`. */
export function measureSkills(root: string): ScopeReading {
    const base = path.join(root, 'src', 'skills');
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
        throw new DeadScopeError(
            'check_routing_coverage',
            'src/skills is unreadable — the routed-skill denominator cannot be measured.',
        );
    }
    let units = 0;
    let cases = 0;
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (!fs.existsSync(path.join(base, e.name, 'SKILL.md'))) continue;
        units += 1;
        if (fs.existsSync(path.join(base, e.name, 'evals', 'triggers.json'))) cases += 1;
    }
    return { scope: 'skills', cases, units, ratio: units === 0 ? 0 : cases / units };
}

/**
 * The skills carrying no `evals/triggers.json`, grouped by the packs they declare.
 *
 * `road-to-a-menu-whose-precision-is-measured` 2.1's second half. The ratio above
 * says HOW MANY are uncovered; this says WHICH, in the grouping a contributor
 * can act on — a pack owner can take their own column without reading the other
 * twenty-six. A skill declaring several packs appears under each, so the column
 * sums CAN exceed the total. Measured 2026-09-29 they do not: no skill in this
 * tree declares more than one pack, so the columns sum to exactly the total.
 * Stated as a property of the renderer rather than of today's tree, because a
 * reader checking the arithmetic against the table needs to know which it is.
 *
 * A skill declaring no pack lands under `(no pack declared)` rather than being
 * dropped, because a silently omitted skill is exactly the coverage hole this
 * census exists to make visible.
 */
export function uncoveredByPack(root: string): Record<string, string[]> {
    const base = path.join(root, 'src', 'skills');
    const out: Record<string, string[]> = {};
    for (const e of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!e.isDirectory()) continue;
        const skillMd = path.join(base, e.name, 'SKILL.md');
        if (!fs.existsSync(skillMd)) continue;
        if (fs.existsSync(path.join(base, e.name, 'evals', 'triggers.json'))) continue;
        const packs = readPacks(skillMd);
        for (const p of packs.length > 0 ? packs : ['(no pack declared)']) {
            (out[p] ??= []).push(e.name);
        }
    }
    return out;
}

/** The `packs:` list from a SKILL.md frontmatter block. Line-oriented on purpose. */
function readPacks(skillMd: string): string[] {
    const text = fs.readFileSync(skillMd, 'utf-8');
    if (!text.startsWith('---')) return [];
    const end = text.indexOf('\n---', 3);
    if (end === -1) return [];
    const lines = text.slice(3, end).split('\n');
    const at = lines.findIndex((l) => /^packs:/u.test(l));
    if (at === -1) return [];
    const out: string[] = [];
    for (let i = at + 1; i < lines.length; i += 1) {
        const m = /^\s+-\s+(\S+)\s*$/u.exec(lines[i] as string);
        if (!m) break;
        out.push(m[1] as string);
    }
    return out;
}

/** Render the census as the markdown section `docs/SKILL_CENSUS.md` carries. */
export function renderUncoveredCensus(root: string): string[] {
    const byPack = uncoveredByPack(root);
    const reading = measureSkills(root);
    const total = reading.units - reading.cases;
    const L: string[] = [];
    L.push(`Skills with no \`evals/triggers.json\`: **${String(total)} of ${String(reading.units)}**.`);
    L.push('');
    L.push('| Pack | Uncovered | Skills |');
    L.push('|---|---:|---|');
    for (const pack of Object.keys(byPack).sort()) {
        const names = byPack[pack] as string[];
        L.push(`| \`${pack}\` | ${String(names.length)} | ${names.map((n) => `\`${n}\``).join(', ')} |`);
    }
    return L;
}

export function readSeed(root: string): Seed {
    const p = path.join(root, SEED_REL);
    let raw: string;
    try {
        raw = fs.readFileSync(p, 'utf-8');
    } catch {
        throw new DeadScopeError(
            'check_routing_coverage',
            `${SEED_REL} is missing — a ratchet with no seed passes every tree.`,
        );
    }
    const doc = JSON.parse(raw) as { seed?: Partial<Seed> };
    const s = doc.seed ?? {};
    if (typeof s.rules !== 'number' || typeof s.skills !== 'number') {
        throw new DeadScopeError(
            'check_routing_coverage',
            `${SEED_REL} carries no numeric seed for both scopes.`,
        );
    }
    return { rules: s.rules, skills: s.skills };
}

/** The ref the touched-skill scope diffs against when `--base` is not given. */
export const TOUCHED_BASE_DEFAULT = 'origin/main';

/** One git invocation: the lines it printed, and whether it actually ran. */
interface GitRead {
    lines: string[];
    ok: boolean;
}

function gitLines(root: string, args: string[]): GitRead {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf-8', env: gitEnv() });
    return { lines: r.status === 0 ? r.stdout.split('\n') : [], ok: r.status === 0 };
}

/**
 * Paths the BRANCH added or changed against `base`.
 *
 * `ok` is separate from the path list and that separation is the whole point: a
 * failed `git diff` and a diff that changed nothing both print zero lines, and
 * reading the first as the second is how a gate reports green over a corpus it
 * never saw. `ok: false` means the branch arm was not measured, never that it
 * was measured and found empty.
 *
 * `ACMR` and not `D`: a DELETED skill cannot be asked for a corpus, and reading
 * a deletion as an uncovered touch would make removing a skill impossible.
 */
export function branchPaths(root: string, base: string): GitRead {
    return gitLines(root, ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
}

/**
 * Paths changed in this checkout with no base ref involved — dirty, staged and
 * untracked.
 *
 * Measured even when the branch arm cannot be: these three need no merge base,
 * so discarding them because a base ref is unresolvable throws away the
 * coverage that WAS available. Untracked is included so a brand-new skill
 * counts as touched before its first commit.
 */
export function localPaths(root: string): string[] {
    return [
        ...new Set([
            ...gitLines(root, ['diff', '--name-only', '--diff-filter=ACMR']).lines,
            ...gitLines(root, ['diff', '--name-only', '--diff-filter=ACMR', '--cached']).lines,
            ...gitLines(root, ['ls-files', '--others', '--exclude-standard']).lines,
        ]),
    ].filter((f) => f.trim().length > 0);
}

/** Every path the diff touched, branch arm included when it could be read. */
export function changedPaths(root: string, base: string): string[] {
    const branch = baseUsable(root, base) ? branchPaths(root, base).lines : [];
    return [...new Set([...branch, ...localPaths(root)])].filter((f) => f.trim().length > 0);
}

/**
 * True when `base` can actually be diffed against, not merely named.
 *
 * Ref existence is NOT the question, and assuming it was is the defect this
 * function is named after. In a shallow clone `git rev-parse origin/main` exits
 * 0 while `git diff origin/main...HEAD` exits 128 with `no merge base`, because
 * the common ancestor was never fetched. The only honest probe is the diff
 * itself, so that is what this runs.
 */
export function baseUsable(root: string, base: string): boolean {
    if (!gitLines(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).ok) return false;
    return branchPaths(root, base).ok;
}

/** Retained name for the ref-existence half alone. Prefer {@link baseUsable}. */
export function baseResolvable(root: string, base: string): boolean {
    return gitLines(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).ok;
}

export interface TouchedReading {
    /** Skills the diff changed, sorted. */
    touched: string[];
    /** Of those, the ones with no `evals/triggers.json`, sorted. */
    uncovered: string[];
    /**
     * False when the BRANCH arm could not be read — an unresolvable base, or a
     * shallow clone with no merge base. The local arms below are still measured
     * and can still fail the run; `measured: false` narrows what the run may
     * CLAIM, it does not switch the scope off.
     */
    measured: boolean;
    base: string;
}

/**
 * Which skills the diff touched, and which of those still have no corpus.
 *
 * An unresolvable base is NOT an empty touch set. A shallow clone, a detached
 * build or a fresh worktree with no remote would otherwise report "nothing
 * touched" and pass, which is the silent-green shape this repository's gates are
 * written against. It reports `measured: false` and the caller says so out loud.
 */
export function measureTouchedSkills(root: string, base: string): TouchedReading {
    const measured = baseUsable(root, base);
    const rels = measured ? changedPaths(root, base) : localPaths(root);
    const names = new Set<string>();
    for (const rel of rels) {
        const m = /^src\/skills\/([^/]+)\//.exec(rel.replace(/\\/g, '/'));
        if (m?.[1] !== undefined) names.add(m[1]);
    }
    const touched = [...names].sort();
    const uncovered = touched.filter(
        (n) =>
            fs.existsSync(path.join(root, 'src', 'skills', n, 'SKILL.md')) &&
            !fs.existsSync(path.join(root, 'src', 'skills', n, 'evals', 'triggers.json')),
    );
    return { touched, uncovered, measured, base };
}

export interface Verdict {
    readings: ScopeReading[];
    seed: Seed;
    fallen: Scope[];
    touched: TouchedReading;
    ledger: GateLedger;
}

/**
 * Compare against the seed.
 *
 * Rounded to four decimals before comparing: an un-rounded float makes a ratio
 * that did not change fail on a representation difference, which is a red the
 * contributor cannot act on.
 */
/**
 * The comparison precision, shared by the verdict AND the display.
 *
 * Exported because the first version rounded only inside `evaluate` and printed
 * the raw float: rules read 0.895238… against a seed of 0.8952 and rendered `↑`,
 * skills read 0.254180… against 0.2542 and rendered `❌`, while the summary line
 * correctly said green. A gate whose rows contradict its verdict is worse than
 * one that is simply wrong, because the reader cannot tell which half to trust.
 */
export function r4(n: number): number {
    return Math.round(n * 10_000) / 10_000;
}

export function evaluate(root = REPO_ROOT, base = TOUCHED_BASE_DEFAULT): Verdict {
    const seed = readSeed(root);
    const readings = [measureRules(root), measureSkills(root)];
    // The ledger's target is the SCOPE, not the individual unit: this gate's
    // verdict is per scope, so a ledger over 404 units would report 404 rows
    // no one can act on while hiding which of the two actually fell.
    const ledger = new GateLedger('check_routing_coverage');
    ledger.plan([...readings.map((r) => r.scope), 'touched']);
    const fallen: Scope[] = [];
    for (const r of readings) {
        if (r4(r.ratio) < r4(seed[r.scope])) {
            fallen.push(r.scope);
            ledger.fail(
                r.scope,
                `${r.ratio.toFixed(4)} < seed ${seed[r.scope].toFixed(4)} ` +
                    `(${String(r.cases)}/${String(r.units)})`,
            );
        } else {
            ledger.complete(r.scope);
        }
    }
    const touched = measureTouchedSkills(root, base);
    if (touched.uncovered.length > 0) {
        ledger.fail('touched', `${String(touched.uncovered.length)} touched skill(s) with no corpus`);
    } else if (!touched.measured) {
        // A finding outranks the precondition: the local arms need no base ref,
        // so an uncovered skill they found is a real failure even though the
        // branch arm did not run. Only a CLEAN unmeasured run is a skip.
        ledger.skip('touched', 'precondition_unmet');
    } else {
        ledger.complete('touched');
    }
    return { readings, seed, fallen, touched, ledger };
}

/**
 * Build a synthetic tree with `r` routed rules of which `rc` carry a fixture,
 * and `s` routed skills of which `sc` carry a triggers file, plus a seed.
 *
 * A REALISTIC corpus rather than a minimal one: both scopes are always
 * populated, because the gate reports two scopes and a fixture that leaves one
 * empty would red for the empty scope no matter what the case under test does.
 */
function selfTestRoot(
    tmp: string,
    spec: { r: number; rc: number; s: number; sc: number; seed?: Partial<Seed> | null },
): string {
    const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
    const ids: { id: string }[] = [];
    const mdir = path.join(root, 'tests', 'eval', 'routing-matrix');
    fs.mkdirSync(mdir, { recursive: true });
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    for (let i = 0; i < spec.r; i += 1) {
        ids.push({ id: `st-rule-${String(i)}` });
        if (i < spec.rc) fs.writeFileSync(path.join(mdir, `st-rule-${String(i)}.yaml`), 'cases: []\n');
    }
    fs.writeFileSync(
        path.join(root, 'dist', 'router.json'),
        JSON.stringify({ tier_1: ids.slice(0, 1), tier_2: ids.slice(1) }),
    );
    for (let i = 0; i < spec.s; i += 1) {
        const d = path.join(root, 'src', 'skills', `st-skill-${String(i)}`);
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'SKILL.md'), '---\nname: st\n---\n');
        if (i < spec.sc) {
            fs.mkdirSync(path.join(d, 'evals'), { recursive: true });
            fs.writeFileSync(path.join(d, 'evals', 'triggers.json'), '[]\n');
        }
    }
    if (spec.seed !== null) {
        fs.mkdirSync(path.join(root, path.dirname(SEED_REL)), { recursive: true });
        fs.writeFileSync(
            path.join(root, SEED_REL),
            JSON.stringify({ seed: spec.seed ?? { rules: spec.rc / spec.r, skills: spec.sc / spec.s } }),
        );
    }
    return root;
}

/**
 * Turn a self-test root into a git repository with a `base` commit, then apply
 * `edit` as the working-tree change the gate will read as "this diff".
 *
 * A real repository rather than a stubbed diff: the touched scope's whole risk
 * is that its git invocation resolves against the wrong tree (an inherited
 * `GIT_DIR` does exactly that), and a stub would never see it.
 */
function gitBaseline(root: string, edit: (root: string) => void): string {
    const env = gitEnv();
    const git = (...args: string[]): void => {
        const r = spawnSync('git', args, { cwd: root, encoding: 'utf-8', env });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    };
    git('init', '--quiet', '--initial-branch=base');
    git('config', 'user.email', 'selftest@example.invalid');
    git('config', 'user.name', 'selftest');
    git('config', 'commit.gpgsign', 'false');
    git('add', '--all');
    git('commit', '--quiet', '-m', 'baseline');
    edit(root);
    return root;
}

/**
 * Like {@link gitBaseline}, but the edit is COMMITTED on a feature branch.
 *
 * The arm CI actually uses is `git diff <base>...HEAD`, and every case that
 * leaves its edit in the working tree exercises the other three arms instead.
 * A committed fixture is the only one that can fail when the branch arm breaks.
 */
function gitBranchCommit(root: string, edit: (root: string) => void): string {
    gitBaseline(root, () => undefined);
    const env = gitEnv();
    const git = (...args: string[]): void => {
        const r = spawnSync('git', args, { cwd: root, encoding: 'utf-8', env });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    };
    git('checkout', '--quiet', '-b', 'feature');
    edit(root);
    git('add', '--all');
    git('commit', '--quiet', '-m', 'the change');
    return root;
}

/** Write `evals/triggers.json` for a self-test skill. */
function plantCorpus(root: string, skill: string): void {
    const d = path.join(root, 'src', 'skills', skill, 'evals');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'triggers.json'), '[]\n');
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crc-selftest-'));
    const run = (root: string, args: readonly string[] = []): number => {
        process.env['CHECK_ROUTING_COVERAGE_ROOT'] = root;
        try {
            return runGateCli(REAL_REPO_ROOT, 'src/scripts/check_routing_coverage.ts', args, root);
        } finally {
            delete process.env['CHECK_ROUTING_COVERAGE_ROOT'];
        }
    };
    const cases: SelfTestCase[] = [
        {
            name: 'a tree exactly at seed on both scopes is accepted',
            expect: 'accept',
            run: () => run(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 })),
        },
        {
            name: 'a tree ABOVE seed on both scopes is accepted',
            expect: 'accept',
            run: () =>
                run(selfTestRoot(tmp, { r: 10, rc: 9, s: 10, sc: 6, seed: { rules: 0.8, skills: 0.5 } })),
        },
        {
            name: 'a removed rules corpus case is rejected',
            expect: 'reject',
            run: () =>
                run(selfTestRoot(tmp, { r: 10, rc: 7, s: 10, sc: 5, seed: { rules: 0.8, skills: 0.5 } })),
        },
        {
            name: 'a removed skills corpus case is rejected',
            expect: 'reject',
            run: () =>
                run(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 4, seed: { rules: 0.8, skills: 0.5 } })),
        },
        {
            name: 'ADDING routed units with no corpus cases is rejected — the count-ratchet blind spot',
            expect: 'reject',
            run: () =>
                run(selfTestRoot(tmp, { r: 10, rc: 8, s: 12, sc: 5, seed: { rules: 0.8, skills: 0.5 } })),
        },
        {
            name: 'a missing seed exits non-zero rather than passing every tree',
            expect: 'reject',
            run: () => run(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5, seed: null })),
        },
        {
            name: 'an unreadable router exits non-zero rather than reporting coverage of zero',
            expect: 'reject',
            run: () => {
                const root = selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 });
                fs.writeFileSync(path.join(root, 'dist', 'router.json'), 'not json');
                return run(root);
            },
        },
        {
            name: 'TOUCHING a skill that has no evals/triggers.json is rejected',
            expect: 'reject',
            run: () => {
                // st-skill-9 is outside `sc`, so the baseline leaves it corpus-less.
                const root = gitBaseline(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 }), (r) => {
                    fs.appendFileSync(path.join(r, 'src', 'skills', 'st-skill-9', 'SKILL.md'), '\nedited\n');
                });
                return run(root, ['--base', 'base']);
            },
        },
        {
            name: 'touching a skill that DOES carry a corpus is accepted',
            expect: 'accept',
            run: () => {
                const root = gitBaseline(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 }), (r) => {
                    fs.appendFileSync(path.join(r, 'src', 'skills', 'st-skill-0', 'SKILL.md'), '\nedited\n');
                });
                return run(root, ['--base', 'base']);
            },
        },
        {
            name: 'a corpus-less skill the diff did NOT touch is accepted — the scope is the diff',
            expect: 'accept',
            run: () => {
                const root = gitBaseline(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 }), (r) => {
                    fs.writeFileSync(path.join(r, 'unrelated.txt'), 'x\n');
                });
                return run(root, ['--base', 'base']);
            },
        },
        {
            name: 'a NEW corpus-less skill added by the diff is rejected before its first commit',
            expect: 'reject',
            run: () => {
                const root = gitBaseline(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 }), (r) => {
                    const d = path.join(r, 'src', 'skills', 'st-skill-new');
                    fs.mkdirSync(d, { recursive: true });
                    fs.writeFileSync(path.join(d, 'SKILL.md'), '---\nname: st\n---\n');
                    // A corpus-less sibling gains one, so the SKILLS RATIO stays above
                    // seed (6/11 > 0.5) and the only thing left to reject on is the new
                    // skill's own missing corpus. Without this the case rejected for the
                    // ratio instead — green for the wrong reason, which the sabotage
                    // probe caught.
                    plantCorpus(r, 'st-skill-6');
                });
                return run(root, ['--base', 'base']);
            },
        },
        {
            name: 'a skill edited in a COMMIT, not the working tree, is rejected — the arm CI uses',
            expect: 'reject',
            run: () => {
                const root = gitBranchCommit(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 }), (r) => {
                    fs.appendFileSync(path.join(r, 'src', 'skills', 'st-skill-9', 'SKILL.md'), '\nedited\n');
                });
                return run(root, ['--base', 'base']);
            },
        },
        {
            name: 'an UNDIFFABLE base still rejects a dirty uncovered skill — the local arms need no base',
            expect: 'reject',
            run: () => {
                const root = gitBaseline(selfTestRoot(tmp, { r: 10, rc: 8, s: 10, sc: 5 }), (r) => {
                    fs.appendFileSync(path.join(r, 'src', 'skills', 'st-skill-9', 'SKILL.md'), '\nedited\n');
                });
                return run(root, ['--base', 'no-such-ref-at-all']);
            },
        },
    ];
    try {
        return runSelfTest({
            gate: 'check_routing_coverage',
            cases,
            minCases: 13,
            minRejectCases: 9,
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2), root = REPO_ROOT): number {
    if (argv.includes('--self-test')) return selfTest();
    if (argv.includes('--census')) {
        process.stdout.write(`${renderUncoveredCensus(root).join('\n')}\n`);
        return 0;
    }
    const baseIdx = argv.indexOf('--base');
    const base = baseIdx !== -1 ? (argv[baseIdx + 1] ?? TOUCHED_BASE_DEFAULT) : TOUCHED_BASE_DEFAULT;
    let v: Verdict;
    try {
        v = evaluate(root, base);
        reportScanned({
            gate: 'check_routing_coverage',
            scanned: v.readings.reduce((n, r) => n + r.units, 0),
            units: 'routed unit(s)',
            roots: ['dist/router.json', 'src/skills'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    v.ledger.report(argv.includes('--quiet') ? () => undefined : process.stdout.write.bind(process.stdout));
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
        return v.fallen.length > 0 ? 1 : 0;
    }
    for (const r of v.readings) {
        const seed = v.seed[r.scope];
        // Same rounding as the verdict, deliberately: see r4's own comment.
        const mark = r4(r.ratio) < r4(seed) ? '❌' : r4(r.ratio) > r4(seed) ? '↑' : '=';
        process.stdout.write(
            `  ${mark} ${r.scope.padEnd(6)} ${String(r.cases).padStart(4)} / ${String(r.units).padEnd(4)} = ` +
                `${r.ratio.toFixed(4)}  (seed ${seed.toFixed(4)})\n`,
        );
    }
    if (!v.touched.measured) {
        process.stdout.write(
            `  · touched ${String(v.touched.touched.length).padStart(4)} skill(s) from the working ` +
                `tree only — base ${v.touched.base} is not diffable here (missing ref, or a shallow ` +
                `clone with no merge base), so the branch arm did NOT run. ` +
                `${String(v.touched.uncovered.length)} without evals/triggers.json.\n`,
        );
    } else {
        process.stdout.write(
            `  ${v.touched.uncovered.length === 0 ? '=' : '❌'} touched ${String(v.touched.touched.length).padStart(4)} skill(s) ` +
                `vs ${v.touched.base}, ${String(v.touched.uncovered.length)} without evals/triggers.json\n`,
        );
    }
    if (v.fallen.length === 0 && v.touched.uncovered.length === 0) {
        // The claim is narrowed to what actually ran. A single affirmative line
        // covering an unmeasured scope is the silent green this scope exists to
        // refuse, and it would be this gate committing it.
        process.stdout.write(
            v.touched.measured
                ? '✅  routing coverage at or above seed, and every touched skill carries a corpus.\n'
                : '✅  routing coverage at or above seed. ⚠️  The branch arm of the touched-skill ' +
                      `scope did NOT run (base ${v.touched.base} is not diffable here), so nothing ` +
                      'is claimed about skills this branch changed in a commit.\n',
        );
        return 0;
    }
    if (v.touched.uncovered.length > 0) {
        process.stderr.write(
            `❌  ${String(v.touched.uncovered.length)} skill(s) changed by this diff carry no ` +
                'evals/triggers.json:\n' +
                v.touched.uncovered.map((n) => `    · src/skills/${n}/evals/triggers.json\n`).join('') +
                '    The corpus is cheapest to write while the skill is open. Write the trigger ' +
                'cases for each; the discipline each file must meet is enforced by ' +
                'lint_skill_trigger_corpus.\n',
        );
    }
    for (const s of v.fallen) {
        const r = v.readings.find((x) => x.scope === s)!;
        process.stderr.write(
            `❌  ${s} coverage fell: ${r.ratio.toFixed(4)} < seed ${v.seed[s].toFixed(4)} ` +
                `(${String(r.cases)} case(s) over ${String(r.units)} routed unit(s)).\n` +
                '    A ratio falls two ways and the fix differs: a corpus case was removed ' +
                '(restore it), or units were added without cases (add them). Lowering the seed ' +
                `in ${SEED_REL} is a defect, not a fix.\n`,
        );
    }
    return 1;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE)) {
    process.exit(main());
}
