#!/usr/bin/env tsx
/**
 * Generate docs/proof.md — the public, self-verifying trust surface.
 *
 * Market-readiness roadmap Track B / B4. Renders, from real sources, the three
 * proofs a skeptic can check themselves:
 *   1. Every markered public claim binds to a resolvable evidence pointer
 *      (rendered from docs/CLAIMS.md — reuses the check_claims ledger loader).
 *   2. Honest-null results are published, not hidden (pointer to docs/benchmark.md).
 *   3. A "verify it yourself" block — the exact commands that reproduce 1 + 2 on
 *      a fresh checkout.
 *
 * **Generated, never hand-maintained** — drift-checked in CI via `--check`, the
 * same discipline as generate_capabilities_index / generate_cookbook. Output is
 * deterministic (sorted, no timestamp) so `--check` is stable. A proof page that
 * could drift from its sources would undermine the very claim it makes.
 *
 * Usage:
 *     ./scripts-run src/scripts/build_proof            # (re)write docs/proof.md
 *     ./scripts-run src/scripts/build_proof --check    # exit 2 if stale
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { REPO, LEDGER_REL, load_ledger, pointer_unresolved } from './check_claims.js';
import {
    collect as collectEnforcement,
    denominator_line as enforcementDenominatorLine,
    summarise as summariseEnforcement,
} from './check_enforcement_coverage.js';
import { collectSkillGaps } from './check_skill_gaps.js';
import { loadRows as loadComparisonRows } from './check_comparison.js';
import { computeStatus as domainSoundnessStatus } from './domain_soundness_status.js';
import { computeCoverage } from './skill_eval_coverage.js';

const _FILE = fileURLToPath(import.meta.url);
const OUT_REL = 'docs/proof.md';
const BENCH_REL = 'docs/benchmark.md';

class ExitCode extends Error {
    code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

/**
 * The prevented-failure table.
 *
 * Every row names a **failure mode that is prevented**, never a feature. That
 * constraint is the whole discipline: "cross-platform" is a feature and says
 * nothing; "the same rules do not silently differ between the agent you run
 * today and the one you switch to" names what goes wrong without it.
 *
 * Every row cites a ledger claim, and `backs` is not decoration — a cited id
 * that is missing or not `backed` throws, so the table cannot outlive its
 * evidence. This is the guard against the failure it was modelled on: the
 * reference ships an equivalent table whose headline efficiency figure appears
 * only there, an order of magnitude below the cheapest scenario in its own
 * generated benchmark. A number with nowhere to resolve is exactly what this
 * ledger exists to catch, so the table is held to the ledger's own bar.
 *
 * A row with no resolving claim ships WITHOUT a number rather than with an
 * approximate one.
 */
export const PREVENTED_FAILURES: { failure: string; mechanism: string; backs: string }[] = [
    {
        failure: 'A rule says MUST, and nothing anywhere enforces it — so the rule reads as a guarantee while being honour-system.',
        mechanism:
            'Each rule declares `enforced_by:`, and the check **resolves** it: a validator reachable from no taskfile, workflow, or hook manifest counts as unwired, not as covered. Undeclared counts as uncovered.',
        backs: 'enforcement-coverage-resolved',
    },
    {
        failure:
            'A shipped artefact carries a hidden-Unicode or instruction-smuggling payload, and reaches consumers because only the source tree was scanned.',
        mechanism:
            'Source **and** the condensed projection are scanned in CI; a finding blocks the release before publish, not merely the merge.',
        backs: 'shipped-artifacts-hidden-instruction-scanned',
    },
    {
        failure:
            'A count in public prose drifts from the source, and the marketing number quietly stops being true.',
        mechanism:
            'Counts are generated from source and drift-checked; the build fails on a count-shaped prose mention that disagrees, or on two different numbers for the same artefact kind.',
        backs: 'skill-count',
    },
    {
        failure:
            'A host-coverage claim understates or overstates what actually works — for months, on the one surface everybody reads.',
        mechanism: 'The number is pinned by a test over real detection, and the test is re-run as the claim evidence.',
        backs: 'host-agent-count',
    },
    {
        failure:
            'A non-coding domain skill implies proven correctness it never had, because it was forged on a different domain and never checked against one.',
        mechanism:
            'Domain skills are labelled unvalidated until they pass a sourced domain-truth fixture, and the validated count is ratcheted so it cannot quietly fall.',
        backs: 'domain-soundness-scoped',
    },
    {
        failure:
            'Behavioural-eval coverage regresses as skills are added, and the suite looks healthy because only the absolute number is reported.',
        mechanism: 'Coverage is measured per tier and ratcheted in CI, so it can only rise; the gap is published rather than implied away.',
        backs: 'eval-coverage-ratcheted',
    },
];

export function renderPreventedFailures(ledger: ReturnType<typeof load_ledger>): string {
    const L: string[] = [];
    L.push('## What this prevents');
    L.push('');
    L.push('Each row is a failure mode, not a feature — and each cites the ledger');
    L.push('claim that backs it. A row whose claim stopped resolving would fail this');
    L.push('page\'s own generator, so the table cannot outlive its evidence.');
    L.push('');
    L.push('| Failure this prevents | How | Backed by |');
    L.push('|---|---|---|');
    for (const row of PREVENTED_FAILURES) {
        const entry = ledger.get(row.backs);
        if (!entry) {
            throw new Error(
                `build_proof: prevented-failure row cites claim '${row.backs}', which has no ledger entry. ` +
                    'Bind it in docs/CLAIMS.md or drop the row — the table may not carry an unbacked cell.',
            );
        }
        if (entry.status !== 'backed') {
            throw new Error(
                `build_proof: prevented-failure row cites claim '${row.backs}', whose ledger status is ` +
                    `'${entry.status}', not 'backed'. The table may not carry an unbacked cell.`,
            );
        }
        const reverifies = entry.evidence.trim().startsWith('exec:') ? ' ⟳' : '';
        L.push(
            `| ${row.failure.replace(/\|/g, '\\|')} | ${row.mechanism.replace(/\|/g, '\\|')} | ` +
                `[\`${row.backs}\`](CLAIMS.md)${reverifies} |`,
        );
    }
    L.push('');
    L.push('⟳ — the claim carries `exec:` evidence: CI re-runs the command and');
    L.push('compares its exit code, so a stale row turns the build red rather than');
    L.push('ageing quietly into marketing.');
    L.push('');
    return L.join('\n');
}

function render(): string {
    const ledger = load_ledger();
    const entries = [...ledger.values()].sort((a, b) => a.id.localeCompare(b.id));
    const backed = entries.filter((e) => e.status === 'backed');
    const unbacked = entries.filter((e) => e.status === 'unbacked');
    // `resolved-null` is neither backed nor debt: the question was asked, the
    // answer came back null, and the entry is closed. Counting it as debt
    // would inflate the inventory with items that can never shrink; counting
    // it as backed would claim a win that was never measured.
    const resolvedNull = entries.filter((e) => e.status === 'resolved-null');

    const L: string[] = [];
    L.push('<!-- GENERATED by build_proof — do NOT hand-edit.');
    L.push('     Drift-checked in CI (`task build-proof-check`). Regenerate with');
    L.push('     `./scripts-run src/scripts/build_proof` after editing docs/CLAIMS.md. -->');
    L.push('');
    L.push('# Proof — verify our claims yourself');
    L.push('');
    L.push('We sell falsifiability, so the selling is machine-checked. Every');
    L.push('public claim binds to resolvable evidence; a skeptic can reproduce');
    L.push('every check below on a fresh checkout. This page is itself generated');
    L.push('from those sources and fails CI if it drifts.');
    L.push('');
    L.push(renderPreventedFailures(ledger));
    L.push('## See it run (< 60s, real output)');
    L.push('');
    L.push('![The trust surface running green — every "verify it yourself" command below, recorded from a real run](media/proof-demo.gif)');
    L.push('');
    L.push('The recording is of the exact commands in § 5, nothing staged. Its');
    L.push('commands are re-executed in CI (`.github/workflows/proof-demo.yml`), so a');
    L.push('demo that showed something broken would turn CI red — the recording');
    L.push('cannot drift from current behavior.');
    L.push('');
    L.push('## 1. Every public claim binds to evidence');
    L.push('');
    L.push(`Rendered from [\`${LEDGER_REL}\`](CLAIMS.md). A \`<!-- claim:ID -->\` marker in`);
    L.push('README/docs must resolve to a `backed` entry here with a resolving');
    L.push('evidence pointer, or `task check-claims` fails the build.');
    L.push('');
    L.push('| Claim | Kind | Evidence | Resolves |');
    L.push('|---|---|---|---|');
    for (const e of backed) {
        const un = pointer_unresolved(e.evidence);
        const resolves = un ? `❌ ${un}` : '✅';
        const claim = e.claim.replace(/\|/g, '\\|');
        const evidence = e.evidence.replace(/\|/g, '\\|');
        L.push(`| ${claim} | ${e.kind} | \`${evidence}\` | ${resolves} |`);
    }
    L.push('');
    L.push(`**${backed.length} backed claim(s)** — all evidence pointers resolve in CI.`);
    L.push('');

    // Re-verifiable vs. merely-resolving. The distinction is the point: a
    // pointer proves an artefact exists, not that the claim is still true. Any
    // page that reported only the backed total would hide exactly the gap this
    // ledger was built to expose.
    const execBacked = backed.filter((e) => e.evidence.trim().startsWith('exec:'));
    const pointerOnly = backed.filter((e) => !e.evidence.trim().startsWith('exec:'));
    L.push('### How many of those re-derive themselves');
    L.push('');
    L.push(`**${execBacked.length} of ${backed.length}** backed claims carry \`exec:\` evidence —`);
    L.push('CI re-runs the command and compares its exit code to the claim, so a');
    L.push('stale one turns the build red. The other');
    L.push(`**${pointerOnly.length}** rest on a pointer: CI checks that the artefact`);
    L.push('exists and contains what it should, which cannot distinguish a live');
    L.push('claim from one whose producer nobody has run in months.');
    L.push('');
    L.push('That residue is not an oversight, and it is listed rather than rounded');
    L.push('away. A claim can only re-derive itself when a deterministic command');
    L.push("carries the verdict in its exit code. These cannot, for the reasons");
    L.push('given:');
    L.push('');
    L.push('| Claim | Why it cannot re-execute |');
    L.push('|---|---|');
    for (const e of pointerOnly) {
        const ev = e.evidence.trim();
        const why = /^https?:\/\//.test(ev)
            ? 'external cite — CI does not fetch the network'
            : /benchmark|bench\/|results-/.test(ev)
              ? 'benchmark output — regenerating it needs paid or stochastic model calls no CI job can re-derive'
              : 'prose or contract artefact — no exit code carries the verdict';
        L.push(`| ${e.claim.replace(/\|/g, '\\|').slice(0, 110)} | ${why} |`);
    }
    L.push('');
    L.push('Artefact counts in public prose (skills, commands, governed rules,');
    L.push('guidelines, personas) are **generated from source and CI-drift-checked**:');
    L.push('`update_counts.ts` writes the numbers, `check_artefact_count_messaging.ts`');
    L.push('fails the build on any count-shaped prose mention that drifts from the');
    L.push('source count — or on two different numbers for the same artefact kind.');
    if (unbacked.length > 0) {
        L.push('');
        L.push(`We also publish our **debt**: ${unbacked.length} claim(s) are logged as`);
        L.push('`unbacked` inventory in the ledger — not yet bound, and therefore not');
        L.push('allowed to carry a marker in public prose. Hiding them would be the');
        L.push('opposite of the point.');
    }
    if (resolvedNull.length > 0) {
        L.push('');
        L.push(`And our **nulls**: ${resolvedNull.length} claim(s) are \`resolved-null\` —`);
        L.push('measured, the threshold was missed, and the entry is closed rather than');
        L.push('left open forever. A null that stays filed as pending debt is a claim');
        L.push('quietly waiting to be re-argued.');
    }
    L.push('');
    L.push('## 2. We publish honest nulls');
    L.push('');
    if (fs.existsSync(path.join(REPO, BENCH_REL))) {
        L.push(`Benchmark results — **including the runs where the package changed nothing** —`);
        L.push(`live in [\`${BENCH_REL}\`](benchmark.md). We do not delete a measured null to`);
        L.push('make a number look better; the null is the evidence of honesty.');
        L.push('');
        L.push('The freshest example: the **persona-placebo benchmark** <!-- claim:persona-identity-placebo-null -->');
        L.push('(2026-07-12, 3 arms × 2 providers, blind rubric judge, pre-registered');
        L.push('hypotheses) measured whether famous-figure persona framing improves decision');
        L.push('answers over the bare method text it wraps. It does not (Δ=0.17, p=0.607) —');
        L.push('while provider diversity moved judged quality ~15× more than persona identity.');
        L.push('The measured null closed a planned feature (persona panel-mode) instead of');
        L.push('shipping theater; the full per-cell data is committed at');
        L.push('`internal/bench/reports/persona-placebo.json`.');
    } else {
        L.push('Benchmark results are published under `docs/` including measured nulls.');
    }
    L.push('');
    const cov = computeCoverage();
    const prio = cov.tiers.priority;
    const other = cov.tiers.other;
    const prioLine =
        prio.covered === prio.total
            ? `\`rich\` + routers) are **fully covered (${prio.covered} of ${prio.total})**, the long tail`
            : `\`rich\` + routers, **${prio.covered} of ${prio.total}**) are partially covered; the long tail`;
    L.push('**Behavioural-eval coverage — the honest baseline.** Skill *quality* is only');
    L.push(`as good as its measurement. Today **${cov.overall.covered} of ${cov.overall.total}** skills carry a behavioural`);
    L.push('`evals.json`; the highest-traffic / highest-cost tiers (default-surface +');
    L.push(prioLine);
    L.push(`(${other.covered} of ${other.total}) is not. We publish that gap rather than imply`);
    L.push(`"${cov.overall.total} evaluated skills": coverage is measured per tier`);
    L.push('(`./scripts-run src/scripts/skill_eval_coverage`), **CI-ratcheted so it can');
    L.push('only rise**, and the priority tiers carry a hard **tier floor**: every');
    L.push('rich / default-surface / router skill MUST have a behavioural eval or an');
    L.push('explicit exemption-with-reason in `internal/evals/tier-floor-exemptions.json`');
    L.push('— no silent exemptions (the bright line deliberately replaces a');
    L.push('weighted-coverage score). Authoring long-tail evals is gated on per-case');
    L.push('human ratification (a generated assertion that checks the wrong property is');
    L.push('worse than none), so the number grows deliberately, not overnight.');
    L.push('');
    const ds = domainSoundnessStatus();
    L.push('**Non-coding domain soundness — scoped, not proven.** The `finance` /');
    L.push('`founder` / `ops` / `content` profiles sell concrete domain value (DCF,');
    L.push('runway, RICE, incident command, messaging), but the skills are forged on');
    L.push('TS/PHP — "promising, not proven" off those stacks. A disclaimer floor');
    L.push('bounds *liability*, not *correctness*: a skill can be format-correct,');
    L.push(`disclaimered, and still embed a wrong domain assumption. Today **${ds.validated} of ${ds.total}**`);
    L.push('default-surface domain skills carry a sourced `domain-truth` fixture');
    L.push('(`./scripts-run src/scripts/domain_soundness_status`); the rest are labeled');
    L.push('`unvalidated` and the validated count is CI-ratcheted. The fixtures landed');
    L.push('so far are the **deterministic** targets (runway, unit-economics, DCF,');
    L.push('forecasting, scenario band/sensitivity), whose answer keys are computed');
    L.push('from cited standard formulas — never the skill\'s own output; the');
    L.push('**rubric** targets (incident command, messaging, fundraising, editorial)');
    L.push('need domain-competent grounding and remain unvalidated, so validation');
    L.push('lands deliberately — the gap is published, never implied away.');
    L.push('');
    L.push('**Second-brain substrate — measured recall lift, honestly bounded.** On a');
    L.push('deterministic multi-session recall corpus, the memory substrate beats a');
    L.push('no-memory baseline AND an equal-byte placebo: memory-on **27/27** vs');
    L.push('no-memory **10/27** vs placebo **9/27** (claude-haiku-4-5, 9 tasks × 3');
    L.push('seeds, sign test **p = 0.031** for both pairings) — a real,');
    L.push('placebo-controlled lift (`internal/bench/reports/second-brain-delta.json`).');
    L.push('Scoped, not oversold: this is the context-value upper bound (perfect');
    L.push('retrieval on a one-fact-per-task corpus), NOT retrieval precision under a');
    L.push('large store; the lift concentrates exactly where memory is the only source');
    L.push('and ties where the prompt self-contains the fact. Boundary vs a human PKM,');
    L.push('and why the Obsidian export stays declined, are in');
    L.push('[`docs/second-brain-scope.md`](second-brain-scope.md).');
    L.push('');
    L.push('A follow-up removed the perfect-retrieval assumption: against a store of');
    L.push('keyword-overlapping confusers the REAL retrieval recalls the needed');
    L.push('decision into the top-5 (9/9) and the model disambiguates it — retrieval-on');
    L.push('**27/27** vs no-memory **5/27** and vs placebo **5/27** (p=0.008 both). The');
    L.push('honest limit: the keyword scorer recalls but does not rank (mean tie-set');
    L.push('3.3), which is the SQLite-FTS5 activation signal (ADR-116) at scale.');
    L.push('');
    L.push('## 3. Known limits (published, witness-tested)');
    L.push('');
    const skillGaps = collectSkillGaps();
    if (skillGaps.length === 0) {
        L.push('No skill has logged a known-limit `gaps:` entry yet. When one does, it');
        L.push('appears here with a witness test that reproduces the limitation — the');
        L.push('transparency surface a headline-benchmark structurally cannot ship.');
    } else {
        L.push('Each limitation below is stated by the skill itself and carries a witness');
        L.push('test that reproduces it. If the limitation is ever fixed, its witness goes');
        L.push('red — so a "Known limit" can never quietly become false.');
        L.push('');
        L.push('| skill | known limit | witness |');
        L.push('|---|---|---|');
        for (const sg of skillGaps) {
            for (const g of sg.gaps) {
                const desc = g.description.replace(/\|/g, '\\|');
                L.push(`| \`${sg.skill}\` | ${desc} | [\`${g.witness}\`](../${g.witness}) |`);
            }
        }
    }
    L.push('');
    L.push('## 4. What is checkable — us vs. the category');
    L.push('');
    const cmpRows = loadComparisonRows();
    if (cmpRows.length === 0) {
        L.push('No comparison rows recorded yet.');
    } else {
        L.push('This is not a takedown — the point is the last column. For each claim,');
        L.push('our evidence is a pointer you can resolve on a fresh checkout; the wider');
        L.push('category is described only by what is publicly observable, never a named');
        L.push('competitor and never a counter-claim to anyone\'s headline number. A claim');
        L.push('is "checkable" only when its `our evidence` pointer resolves — CI enforces');
        L.push('that (`task check-comparison`), so this column can never lie.');
        L.push('');
        L.push('| Claim | Our evidence | The category | Checkable? |');
        L.push('|---|---|---|---|');
        for (const r of cmpRows) {
            const claim = r.claim.replace(/\|/g, '\\|');
            const theirs = r.their_evidence.replace(/\|/g, '\\|');
            const filePart = (r.our_evidence.split('#')[0] ?? r.our_evidence).split(':')[0] ?? r.our_evidence;
            const ours = pointer_unresolved(r.our_evidence) === null
                ? `[\`${r.our_evidence}\`](../${filePart})`
                : `\`${r.our_evidence}\``;
            L.push(`| ${claim} | ${ours} | ${theirs} | ${r.checkable ? '✅' : '—'} |`);
        }
    }

    // Second lens on the SAME rows: what each one prevents, for a reader who has
    // not asked "compared to what". Membership is a data property — a row appears
    // here iff it carries a `failure_mode` — so nobody curates a short-list that
    // then drifts from the table above. The pointer is the same pointer, resolved
    // by the same gate, so no cell reaches this view unbound.
    const fmRows = cmpRows.filter((r) => (r.failure_mode ?? '').trim() !== '');
    if (fmRows.length > 0) {
        L.push('');
        L.push('### What each one prevents');
        L.push('');
        L.push('The same rows, read as failure modes rather than as comparisons. Each names');
        L.push('something that goes wrong without the control and carries the identical');
        L.push('resolvable pointer — a projection of the table above, not a second list to');
        L.push('keep in sync.');
        L.push('');
        L.push('| Without it | The control | Evidence |');
        L.push('|---|---|---|');
        for (const r of fmRows) {
            const fm = (r.failure_mode ?? '').replace(/\|/g, '\\|').trim();
            const claim = r.claim.replace(/\|/g, '\\|');
            const filePart = (r.our_evidence.split('#')[0] ?? r.our_evidence).split(':')[0] ?? r.our_evidence;
            const ours = pointer_unresolved(r.our_evidence) === null
                ? `[\`${r.our_evidence}\`](../${filePart})`
                : `\`${r.our_evidence}\``;
            L.push(`| ${fm} | ${claim} | ${ours} |`);
        }
    }

    L.push('');
    L.push('## 4b. The two existing axes — enforcement level per rule, evidence form per claim');
    L.push('');
    L.push('Pure projection of what the repo already knows — the `enforced_by`');
    L.push('resolution (`check_enforcement_coverage`) and the claims ledger');
    L.push(`(\`${LEDGER_REL}\`). No new taxonomy, zero hand-written rows.`);
    L.push('');
    {
        const rows = collectEnforcement();
        const s = summariseEnforcement(rows);
        L.push(
            `**Axis 1 — enforcement level per rule.** ${s.total} rules · ` +
                `${s.blocking} blocking (${s.blocking_pct}%) · ${s.observer} observer · ` +
                `${s.local_only} local-only · ${s.undeclared} undeclared (no \`enforced_by\` yet).`,
        );
        L.push('');
        // The denominator, WITH the frame that produced it. Until 2026-08-23 the
        // tree published five figures for this one property because every one was
        // quoted without saying which population it was taken over. This line is
        // the single sanctioned statement of it, and `check_enforcement_denominator`
        // reds when a published doc restates a count instead of citing this block.
        L.push(`\`${enforcementDenominatorLine(s.frames)}\``);
        L.push('');
        L.push('| Rule | Effective level | Declared backstop(s) |');
        L.push('|---|---|---|');
        const declared = rows
            .filter((r) => r.declared.length > 0)
            .sort((a, b) => a.id.localeCompare(b.id));
        for (const r of declared) {
            const decl = r.declared.map((d) => `\`${d}\``).join('<br>');
            L.push(`| \`${r.id}\` | ${r.effective} | ${decl} |`);
        }
        L.push('');
        L.push(`Undeclared rules (${s.undeclared}) carry no row — an honest gap beats a false claim.`);
    }
    L.push('');
    {
        const ledger = [...load_ledger().values()].sort((a, b) => a.id.localeCompare(b.id));
        const backed = ledger.filter((e) => e.status === 'backed').length;
        const nulls = ledger.filter((e) => e.status === 'resolved-null').length;
        L.push(
            `**Axis 2 — evidence form per public claim.** ${ledger.length} ledger entries · ` +
                `${backed} backed · ${ledger.length - backed - nulls} unbacked inventory · ` +
                `${nulls} resolved-null.`,
        );
        L.push('');
        // `Measured on` exists because a status alone cannot say that a real
        // measurement describes a build that no longer exists — and an AI
        // council (2026-08-26, 2/2) required the binding to reach every index,
        // not only the detailed entry, since a prose-only qualification drifts
        // from the structured record it qualifies. Empty for every claim that
        // describes the current tree, which is almost all of them.
        L.push('| Claim id | Kind | Status | Measured on | Evidence pointer |');
        L.push('|---|---|---|---|---|');
        for (const e of ledger) {
            const ev = e.evidence.length > 0 ? `\`${e.evidence.replace(/\|/g, '\\|')}\`` : '—';
            const on = e.measured_on.length > 0 ? e.measured_on.replace(/\|/g, '\\|') : '—';
            L.push(`| \`${e.id}\` | ${e.kind} | ${e.status} | ${on} | ${ev} |`);
        }
    }
    L.push('');
    L.push('## 5. Verify it yourself');
    L.push('');
    L.push('On a fresh checkout, reproduce the claims above:');
    L.push('');
    L.push('```bash');
    L.push('task check-claims   # every markered public claim binds to resolvable evidence');
    L.push('task check-refs     # no broken internal references');
    L.push('task check-skill-gaps    # every logged known-limit cites a real witness test');
    L.push('task check-comparison    # every comparison-table "our evidence" pointer resolves');
    L.push('./scripts-run src/scripts/skill_eval_coverage         # behavioural-eval coverage, per tier');
    L.push('./scripts-run src/scripts/skill_eval_coverage --check # the ratchet: coverage may not drop');
    L.push('task build-proof-check   # this page is in sync with its sources');
    L.push('```');
    L.push('');
    L.push('If a claim ever loses its binding, or this page drifts from the ledger,');
    L.push('CI goes red. Reproducibility is the proof.');
    L.push('');
    return L.join('\n');
}

function main(argv: string[] = process.argv.slice(2)): number {
    const check = argv.includes('--check');
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write('usage: build_proof [--check]\n');
        return 0;
    }
    const out = render();
    const outPath = path.join(REPO, OUT_REL);
    if (check) {
        const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
        if (current !== out) {
            process.stderr.write(
                `❌  build_proof: ${OUT_REL} is stale. Run './scripts-run src/scripts/build_proof' and commit.\n`,
            );
            return 2;
        }
        process.stdout.write(`✅  build_proof: ${OUT_REL} in sync.\n`);
        return 0;
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, out);
    process.stdout.write(`✅  build_proof: wrote ${OUT_REL}.\n`);
    return 0;
}

function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (a === _FILE || pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(_FILE);
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    try {
        process.exit(main());
    } catch (exc) {
        if (exc instanceof ExitCode) process.exit(exc.code);
        throw exc;
    }
}

export { render, main, OUT_REL };
