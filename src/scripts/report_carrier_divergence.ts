#!/usr/bin/env tsx
/**
 * report_carrier_divergence.ts — which rules the two carriers deliver
 * differently, BY NAME.
 *
 * Executes round-5 Phase 1.3, landed under round-6 Phase 4.1. Advisory: **it
 * gates on nothing** and must not acquire a threshold, for the reason
 * `report_skill_activation` and `report_imperative_density` must not — plus one
 * specific to this surface, below.
 *
 * WHY THIS EXISTS
 * ---------------
 * The suite installs machine-globally (`~/.claude/rules/`) and the package's own
 * checkout also projects per-project (`dist/agent-src/rules/`, which every
 * project-scope tree symlinks). A machine that has both loads the shared rules
 * twice, and nothing said whether the two copies agree. Round 5 measured the
 * condition once and named the dangerous case: its global copy of
 * `git-history-discipline` asserted an unqualified "deterministically blocked by
 * the `block-no-verify` PreToolUse guard" while the shipped copy carried the
 * host-scoped retraction of exactly that claim. The agent held both, with no
 * precedence marker.
 *
 * A one-off measurement cannot own that condition, because the condition is
 * **transient and maintainer-dependent**: it appears when the checkout moves
 * ahead of the installed release and disappears the next time the maintainer
 * reinstalls. Verified both directions — see § THE 2026-08-08 RE-MEASUREMENT.
 * So the deliverable is a report anyone can re-run, not a number in a roadmap.
 *
 * WHY IT MUST NOT BECOME A GATE
 * -----------------------------
 * A maintainer developing the package is *legitimately* ahead of their own
 * global install — `condense.ts` says so where it explains why the byte-keyed
 * dedup is inert in that state. A gate here would fail on the normal
 * development condition, and a gate that fires on sanctioned behaviour gets
 * ignored, which is the failure `check-rule-invariants` already paid for once.
 * The point is that the condition becomes VISIBLE, not that it becomes illegal.
 *
 * BEFORE QUOTING A COUNT FROM THIS REPORT
 * ---------------------------------------
 * Read `agents/settings/contexts/carrier-divergence-109-vs-24.md` first. The
 * figure "109 divergent pairs, binding undefined" reached five independent
 * release reviews as the tree's largest technical debt; all 109 carry
 * byte-identical prose, and the real actionable set is the 24-pair `paths:`
 * subset below, in the over-delivery direction. That correction had no stable
 * surface, which is why every fresh reader re-derived the wrong number from
 * this report's own output.
 *
 * THE FOUR CLASSES, AND WHICH ONE A READER MUST ACT ON
 * ---------------------------------------------------
 *   body-diff        the two carriers deliver different PROSE. This is the class
 *                    round 5's contradiction lived in, and the only one that
 *                    needs a decision. What the host does about it: NOTHING —
 *                    both copies load at launch with the same priority and no
 *                    precedence marker between them, so the divergence is
 *                    binding-undefined rather than resolved in either
 *                    direction. Cited, not inferred:
 *                    `agents/evidence/analysis/claude-code-rules-dir-contract.md`
 *                    (host 2.1.226, first-party observation plus the host's own
 *                    documentation). The project copy is the NEWER text, which
 *                    is a fact about recency and not a precedence rule — the
 *                    earlier wording of this header called it a win, and a
 *                    reader acting on that would have believed the host resolves
 *                    something it does not.
 *   frontmatter-only the prose is byte-identical and only the metadata block
 *                    differs. Split out because it was, measured, the ENTIRE
 *                    content of the `body-diff` class: 109 of 109 on 2026-08-10.
 *                    Left inside body-diff it manufactured the report's only
 *                    actionable class out of a metadata difference — the same
 *                    mistake the `unreadable` branch below already refuses to
 *                    make.
 *                    NOT inert as a whole, and an earlier version of this entry
 *                    wrongly said it was: the `paths:` SUBSET below is reported
 *                    separately and IS actionable. Only the remainder — keys this
 *                    host does not read — is safe to ignore.
 *   `paths:` subset  a `frontmatter-only` pair whose two copies disagree about
 *                    `paths`, the one frontmatter key the host reads. It decides
 *                    WHEN a rule loads (matching-file read and no /compact
 *                    re-injection, versus unconditionally at launch), so the copy
 *                    without `paths` DEFEATS the other's scoping and an
 *                    obligation someone deliberately scoped is silently unscoped.
 *                    Measured 2026-08-10: 24 of the 109, all of them `paths` in
 *                    the project copy and none in the global one. Identical prose
 *                    does not make a schedule difference inert.
 *   provenance-only  identical after removing the two installer ownership keys.
 *                    Structural, expected, and decided against closing —
 *                    `agents/settings/contexts/dedup-reachability-refusal.md`.
 *                    Reported as a count with that pointer, never as a finding,
 *                    or the real class drowns in it.
 *   one-carrier-only a rule present at exactly one scope. Not a contradiction:
 *                    project-only is a rule newer than the installed release,
 *                    global-only is a rule the release still carries. Named
 *                    because asymmetric reach is what makes a project-scope
 *                    measurement non-transferable to another machine.
 *
 * NOT IN SCOPE. Skills, commands and contexts have the same two-carrier shape
 * and are not compared here; this executes the rule-scoped step that was
 * specified. Nor does it compare `~/.claude/CLAUDE.md` against the project's
 * `CLAUDE.md` — a different mechanism with a different precedence story.
 *
 * Exit: 0 always, except a usage error (1). Deliberate — see above.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    comparePair,
    frontmatterPaths,
    type PairVerdict,
    proseEqual,
    splitFrontmatter,
} from './_lib/carrier_divergence.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/**
 * The project carrier — the tree the host actually reads at project scope, NOT
 * `dist/agent-src/rules/`.
 *
 * The distinction is load-bearing and was found by measuring: the global
 * installer delivers the five ADR-004 `type: manual` rules while the project
 * projection deliberately omits them, so anchoring on `dist` (which holds all
 * 115) reports those five as *shared* when in fact only one carrier delivers
 * them. Two writers, different filters — exactly the asymmetry this report
 * exists to name. `dist` is still read, as the reference for what COULD be
 * projected, which is what makes the manual class attributable rather than a
 * bare absence.
 */
export const PROJECT_RULES = path.join('.claude', 'rules');
/** What the project projection is generated from — the reference set. */
export const PROJECTION_SOURCE = path.join('dist', 'agent-src', 'rules');
/** The machine-global carrier, relative to the user's home. */
export const GLOBAL_RULES = path.join('.claude', 'rules');

export interface CarrierDivergence {
    projectDir: string;
    globalDir: string;
    /** `false` when the global carrier is absent — every count is then 0. */
    globalPresent: boolean;
    /** `false` when the project tree has not been generated in this checkout. */
    projectPresent: boolean;
    shared: number;
    identical: string[];
    provenanceOnly: string[];
    /**
     * Prose byte-identical, metadata block different. A real byte difference — so
     * `comparePair` still calls it `body-diff` and the dedup predicate is
     * unchanged — but not a difference in what the host delivers, so it is not
     * something a reader has to act on.
     */
    frontmatterOnly: string[];
    /**
     * A SUBSET of `frontmatterOnly` whose two copies disagree about `paths:` —
     * the one frontmatter key this host reads. Same prose, different load
     * schedule, so this one IS actionable and must not be reported as inert
     * metadata.
     */
    pathsScopeDiff: string[];
    bodyDiff: string[];
    projectOnly: string[];
    globalOnly: string[];
    /**
     * Shared names whose copies could not both be read (a dangling symlink from a
     * half-finished install). Counted rather than dropped: a pair that silently
     * leaves `shared` makes every other number in the report unaccounted for.
     */
    unreadable: string[];
    /**
     * Rules the projection source carries, the global carrier delivers, and the
     * project projection omits by design (`type: manual`). A subset of
     * `globalOnly`, separated so the expected half does not read as drift.
     */
    manualOnlyGlobal: string[];
}

function _listRules(dir: string): string[] {
    try {
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.md'))
            .sort();
    } catch {
        return [];
    }
}

/**
 * `type:` from a rule's frontmatter, or `''` when unreadable / absent.
 *
 * Reads the shared fence parser rather than re-implementing one. It used to
 * carry its own, and the two disagreed on an unterminated fence: this one
 * treated the WHOLE file as frontmatter, so a `type:` line anywhere in the prose
 * could be read as the rule's type. Now an unterminated fence yields no
 * frontmatter and therefore no type — the conservative answer, since attributing
 * a rule to the ADR-004 manual filter on a malformed read would hide it from the
 * drift list.
 */
function _ruleType(file: string): string {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return '';
    }
    const m = /^type:\s*"?([a-z]+)"?/m.exec(splitFrontmatter(text).frontmatter);
    return m === null ? '' : (m[1] as string);
}

/**
 * Compare the two carriers over the UNION of their rule names.
 *
 * The union is the point: anchoring on either side alone hides one direction of
 * asymmetric reach, and it was the hidden direction — rules the global install
 * carries and the project does not — that made round 5's cross-project
 * comparison hard to interpret.
 *
 * `sourceDir` is the projection source, read only to attribute a global-only
 * rule to the ADR-004 manual filter rather than to drift. Absent → the manual
 * split is simply empty, never a guess.
 */
export function compareCarriers(
    projectDir: string,
    globalDir: string,
    sourceDir?: string,
): CarrierDivergence {
    const out: CarrierDivergence = {
        projectDir,
        globalDir,
        globalPresent: fs.existsSync(globalDir),
        projectPresent: fs.existsSync(projectDir),
        shared: 0,
        identical: [],
        provenanceOnly: [],
        frontmatterOnly: [],
        pathsScopeDiff: [],
        bodyDiff: [],
        projectOnly: [],
        globalOnly: [],
        unreadable: [],
        manualOnlyGlobal: [],
    };
    const project = new Set(_listRules(projectDir));
    const global = new Set(_listRules(globalDir));

    for (const rule of [...new Set([...project, ...global])].sort()) {
        const inP = project.has(rule);
        const inG = global.has(rule);
        if (inP && !inG) {
            out.projectOnly.push(rule);
            continue;
        }
        if (!inP && inG) {
            out.globalOnly.push(rule);
            if (sourceDir !== undefined && _ruleType(path.join(sourceDir, rule)) === 'manual') {
                out.manualOnlyGlobal.push(rule);
            }
            continue;
        }
        out.shared += 1;
        let verdict: PairVerdict;
        let projectCopy: Buffer;
        let globalCopy: Buffer;
        try {
            projectCopy = fs.readFileSync(path.join(projectDir, rule));
            globalCopy = fs.readFileSync(path.join(globalDir, rule));
            verdict = comparePair(projectCopy, globalCopy);
        } catch {
            // An unreadable copy is not a body difference and must not be
            // reported as one — a permission error would otherwise manufacture
            // the only class this report asks a reader to act on. It is still
            // NAMED: a pair that just disappears from `shared` leaves the ledger
            // short with nothing saying why.
            out.shared -= 1;
            out.unreadable.push(rule);
            continue;
        }
        if (verdict === 'identical') out.identical.push(rule);
        else if (verdict === 'provenance-only') out.provenanceOnly.push(rule);
        else {
            // Only this branch consumes the prose comparison, so it is computed
            // here rather than beside `comparePair`: on an `identical` or
            // `provenance-only` pair the two `toString` conversions and two fence
            // scans are work whose result is never read.
            const projectText = projectCopy.toString('utf-8');
            const globalText = globalCopy.toString('utf-8');
            if (proseEqual(projectText, globalText)) {
                out.frontmatterOnly.push(rule);
                // `paths:` is the one key the host reads, so a disagreement here
                // is a load-schedule difference, not inert metadata. Recorded as
                // a subset so the count stays reconcilable with `frontmatterOnly`.
                if (frontmatterPaths(projectText) !== frontmatterPaths(globalText)) {
                    out.pathsScopeDiff.push(rule);
                }
            } else out.bodyDiff.push(rule);
        }
    }
    return out;
}

export function render(d: CarrierDivergence): string {
    const lines: string[] = [];
    lines.push('cross-carrier rule divergence — advisory, gates on nothing');
    lines.push(`  project carrier: ${d.projectDir}`);
    lines.push(`  global carrier:  ${d.globalDir}`);
    lines.push('');

    if (!d.globalPresent) {
        lines.push('  The global carrier is absent — this machine loads the project projection');
        lines.push('  only, so there is no second copy to diverge from. Nothing to report, and');
        lines.push('  that is a real answer rather than a skipped check.');
        return lines.join('\n');
    }
    if (!d.projectPresent) {
        lines.push('  The project rule tree does not exist in this checkout — it is generated and');
        lines.push('  gitignored, so a fresh clone has none, and `agents/.agent-tools.yml` may');
        lines.push('  select zero tools deliberately. Run `task generate-tools` and re-run this');
        lines.push('  report. Reported rather than silently substituted with the projection');
        lines.push('  source: dist/ holds rules the project tree omits by design, so reading it');
        lines.push('  as the project carrier would answer a different question than the one asked.');
        return lines.join('\n');
    }

    lines.push(`  shared rule names                    ${d.shared}`);
    lines.push(`    byte-identical                     ${d.identical.length}`);
    lines.push(`    differ ONLY in the install stamp   ${d.provenanceOnly.length}`);
    lines.push(`    differ ONLY in frontmatter         ${d.frontmatterOnly.length}`);
    lines.push(`      of which disagree on \`paths:\`    ${d.pathsScopeDiff.length}  ← ACTIONABLE`);
    lines.push(`    differ in PROSE                    ${d.bodyDiff.length}`);
    if (d.unreadable.length > 0) {
        lines.push(`    unreadable on one side             ${d.unreadable.length}  (${d.unreadable.join(', ')})`);
        lines.push('      Not counted as shared and NOT a body difference — a dangling entry is');
        lines.push('      a broken install, not a disagreement about content.');
    }
    lines.push(`  present at project scope only        ${d.projectOnly.length}`);
    lines.push(`  present at global scope only         ${d.globalOnly.length}`);
    lines.push('');

    if (d.bodyDiff.length > 0) {
        lines.push('  PROSE DIVERGENCE — the two carriers deliver different governed text for');
        lines.push('  these rules. Both copies reach the model, and the host resolves NOTHING:');
        lines.push('  rules without a `paths` key load at launch with the same priority as');
        lines.push('  CLAUDE.md, with no precedence marker between the layers, so a claim one');
        lines.push('  copy retracts can be re-asserted by the other and which text binds is');
        lines.push('  UNDEFINED. Cited, not inferred — agents/evidence/analysis/');
        lines.push('  claude-code-rules-dir-contract.md (host 2.1.226, the host\'s own docs plus');
        lines.push('  a first-party observation). The project copy is the NEWER text, which is a');
        lines.push('  fact about recency and NOT a host precedence rule: close the divergence by');
        lines.push('  reinstalling the global copy, or decide which text binds — do not assume');
        lines.push('  the newer one already won.');
        for (const r of d.bodyDiff) lines.push(`    - ${r}`);
        lines.push('');
    }

    if (d.pathsScopeDiff.length > 0) {
        lines.push(`  \`paths:\` SCOPE DISAGREEMENT (${String(d.pathsScopeDiff.length)}) — same prose, different load schedule.`);
        lines.push('  ACT ON THESE. `paths` is the one frontmatter key this host reads: with it, a');
        lines.push('  rule fires when a matching file is read and is NOT re-injected after');
        lines.push('  /compact; without it, the rule loads unconditionally at launch. So the copy');
        lines.push('  that lacks `paths` DEFEATS the other copy\'s scoping — the rule the project');
        lines.push('  layer meant to deliver conditionally is delivered always, and an obligation');
        lines.push('  a maintainer deliberately scoped is silently unscoped on any machine that');
        lines.push('  carries both. Identical prose does not make this inert.');
        for (const r of d.pathsScopeDiff) lines.push(`    - ${r}`);
        lines.push('');
    }

    const inert = d.frontmatterOnly.length - d.pathsScopeDiff.length;
    if (inert > 0) {
        lines.push(`  ${String(inert)} further pair(s) differ ONLY in frontmatter the host does not read —`);
        lines.push('  prose byte-identical, `paths` in agreement, nothing to act on. Two writers,');
        lines.push('  two policies: `generate-tools` emits `paths` where a rule is path-scoped and');
        lines.push('  nothing otherwise; `install.ts` writes agent-config\'s own vocabulary plus its');
        lines.push('  ownership stamp, and none of those keys is one this host reads');
        lines.push('  (claude-code-rules-dir-contract.md). Reported as a count on purpose: naming');
        lines.push('  every pair would bury the two classes above, which are the actionable ones.');
        lines.push('');
    }

    if (d.provenanceOnly.length > 0) {
        lines.push(`  ${String(d.provenanceOnly.length)} pair(s) differ only by the installer's package:/source_path: stamp.`);
        lines.push('  Not a content difference and NOT a defect: install.ts stamps every installed');
        lines.push('  rule, the in-repo projection stamps nothing. Closing it was decided against');
        lines.push('  on 2026-07-31 — agents/settings/contexts/dedup-reachability-refusal.md holds');
        lines.push('  the analysis and the five reopen conditions. Reported as a count on purpose:');
        lines.push('  naming every expected pair would bury the class above.');
        lines.push('');
    }

    if (d.projectOnly.length > 0) {
        lines.push(`  project-scope only (${String(d.projectOnly.length)}) — newer than the installed release:`);
        lines.push(`    ${d.projectOnly.join(', ')}`);
    }
    const driftGlobalOnly = d.globalOnly.filter((r) => !d.manualOnlyGlobal.includes(r));
    if (driftGlobalOnly.length > 0) {
        lines.push(`  global-scope only (${String(driftGlobalOnly.length)}) — the release carries these, this checkout does not project them:`);
        lines.push(`    ${driftGlobalOnly.join(', ')}`);
    }
    if (d.manualOnlyGlobal.length > 0) {
        lines.push(
            `  delivered by the global carrier ONLY, by design (${String(d.manualOnlyGlobal.length)}, ADR-004 \`type: manual\`):`,
        );
        lines.push(`    ${d.manualOnlyGlobal.join(', ')}`);
        lines.push('    The project projection filters these out and the global installer does not.');
        lines.push('    Two writers, different filters — so on a machine with both carriers these');
        lines.push('    rules reach the model, and on a project-only machine they do not. Expected,');
        lines.push('    and worth knowing before citing any project-scope reach figure.');
    }
    if (d.projectOnly.length > 0 || d.globalOnly.length > 0) {
        lines.push('');
        lines.push('  Asymmetric reach is why a project-scope conformance figure does not transfer');
        lines.push('  to another machine: the rule set the model was told differs by carrier.');
    }

    if (d.bodyDiff.length === 0) {
        lines.push('');
        lines.push('  No prose divergence — no rule\'s governed text differs between the carriers.');
        if (d.pathsScopeDiff.length > 0) {
            lines.push('  NOT an all-clear: the `paths:` disagreements above are still open, and they');
            lines.push('  change when a rule loads rather than what it says.');
        }
        lines.push('  The condition is transient — it returns whenever the checkout moves ahead of');
        lines.push('  the installed release — so this is a reading of right now, not a property of');
        lines.push('  the repo. Re-run it, do not cite it. That holds doubly here: the reading also');
        lines.push('  depends on WHICH GENERATION of the emitter produced the project tree (a');
        lines.push('  frontmatter-carrying symlink tree and a frontmatter-less real-file tree');
        lines.push('  classify the same commit differently), so a number from another checkout is');
        lines.push('  not comparable to this one.');
    }
    return lines.join('\n');
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let projectDir = path.join(REPO_ROOT, PROJECT_RULES);
    let globalDir = path.join(os.homedir(), GLOBAL_RULES);
    let sourceDir = path.join(REPO_ROOT, PROJECTION_SOURCE);
    // A value must not itself be a flag. `--project --global /x` otherwise
    // resolves a directory literally named `--global` and silently drops `/x`,
    // reporting "tree does not exist" instead of a usage error — the flag-VALUE
    // half of the hole this file's own test closes on the flag-NAME half.
    const value = (i: number): string | null => {
        const v = args[i + 1];
        return v === undefined || v.startsWith('-') ? null : v;
    };
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        if (a === '--project' || a === '--global' || a === '--source') {
            const v = value(i);
            if (v === null) {
                process.stderr.write(`report_carrier_divergence: ${a} needs a directory\n`);
                return 1;
            }
            const resolved = path.resolve(v);
            if (a === '--project') projectDir = resolved;
            else if (a === '--global') globalDir = resolved;
            else sourceDir = resolved;
            i += 1;
        } else if (a === '--help' || a === '-h') {
            process.stdout.write(
                'usage: report_carrier_divergence [--project DIR] [--global DIR] [--source DIR]\n',
            );
            return 0;
        } else if (a !== undefined && a.startsWith('--') && a !== '--quiet') {
            process.stderr.write(`report_carrier_divergence: unknown flag ${a}\n`);
            return 1;
        }
    }
    process.stdout.write(`${render(compareCarriers(projectDir, globalDir, sourceDir))}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
