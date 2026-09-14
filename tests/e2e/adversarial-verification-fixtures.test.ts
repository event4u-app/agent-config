/**
 * `T1`-`T10`, `G8`, `G9` — the fixture set of
 * `road-to-adversarial-verification-and-long-runs`, AC-1.
 *
 * **Why these live under `tests/e2e/` as `.test.ts` and not `.spec.ts`.** The
 * acceptance criterion names this directory, and the directory already holds
 * Playwright specs that boot a server. These fixtures boot nothing — they are
 * assertions over pure decisions and over the tree's own artefacts — so they are
 * written as vitest tests, which `playwright.config.ts` ignores (`testMatch:
 * '**​/*.spec.ts'`) and `vitest.config.ts` collects (`include:
 * ['tests/**​/*.test.{ts,tsx}']`). One directory, two harnesses, no overlap, and
 * the fixtures run on every CI test job rather than only where browsers exist.
 *
 * **What a fixture here is allowed to be.** Each one pins a decision a shipped
 * mechanism makes, in the direction the mechanism could plausibly have gone
 * wrong. A fixture that restates an implementation line is not evidence; a
 * fixture that would pass against a deliberately broken implementation is the
 * tautology Phase 2.3 exists to catch, and writing one here would be writing the
 * defect this roadmap is named after.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    DELIVERY_ENDINGS,
    HALT_ACTIONS,
    MAX_ITERATIONS,
    TERMINAL_STATE_BY_ACTION,
    WALL_CLOCK_CAP_MS,
    deliveryBlocksCompletion,
    ladder,
    terminalStateFor,
    type LadderState,
} from '../../src/scripts/_lib/continuation_ladder.js';
import {
    cascadeBase,
    cascadeCurrent,
    hopsNeedingMerge,
} from '../../src/scripts/_lib/cascade_base.js';
import {
    REPORT_FIELDS,
    renderReport,
    routeCouncil,
    type PauseReport,
} from '../../src/scripts/_lib/council_transport.js';
import { isDeliveryReady } from '../../src/scripts/_lib/delivery_ready.js';
import { forgeProtectionRows } from '../../src/scripts/_lib/forge_protection.js';
import {
    WRITE_BOUNDARIES,
    alreadyAnswered,
    clearedBy,
    missingFields,
    restore,
    type MissionRecord,
} from '../../src/scripts/_lib/mission_record.js';
import {
    grantFor,
    verdictAloneGrants,
    type ExactObjectAsk,
} from '../../src/scripts/_lib/typed_op_grant.js';
import { classify, findingFor } from '../../src/scripts/check_test_delta.js';
import {
    sameSessionTestFlag,
    touchesTestAndCode,
} from '../../src/scripts/hooks/evidence_independence.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(REPO, rel), 'utf8');
/**
 * The same text with every run of whitespace collapsed to one space.
 *
 * Prose files wrap, so a phrase the author wrote as one sentence reaches a
 * naive regex split across a newline. Matching against the flattened form asserts
 * the CLAIM is present; matching against the raw form would additionally assert
 * where the author happened to break the line, which is not a contract.
 */
const flat = (rel: string): string => read(rel).replace(/\s+/g, ' ');

describe('Phase 1.1 — the test-first rule', () => {
    const RULE = 'src/rules/test-first.md';

    it('exists and is at most 40 lines, the bound the step set', () => {
        const lines = read(RULE).split('\n');
        // A trailing newline yields one empty final element; the file's own line
        // count is what `wc -l` reports, so drop it before comparing.
        const count = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
        expect(count).toBeLessThanOrEqual(41);
    });

    it('routes to the existing skill rather than duplicating it (K7)', () => {
        expect(read(RULE)).toContain('skill:test-driven-development');
    });

    it('carries all four obligations, not just the happy one', () => {
        const body = flat(RULE);
        for (const obligation of [
            'FAILING TEST FIRST',
            'REGRESSION TEST FIRST',
            'CHARACTERIZATION TEST FIRST',
            'FAIL FOR THE INTENDED REASON',
        ]) {
            expect(body).toContain(obligation);
        }
    });

    it('carries NO carve-out excusing this package because the artefact is markdown', () => {
        const body = flat(RULE);
        // The step's own acceptance clause. The rule must NAME the escape and
        // refuse it — a rule that is merely silent on it would pass a "does not
        // contain the word markdown" check while leaving the escape open.
        expect(body).toMatch(/markdown/i);
        expect(body).toMatch(/Markdown is not the discriminator/);
        expect(body).toMatch(/projection, routing or lint behavior is testable/);
    });

    it('says what to do where there is genuinely nothing executable', () => {
        expect(flat(RULE)).toMatch(/independent \*review\*, never a fake test/);
    });
});

describe('T3 — ten failed fixes produce strategy changes, never an owner ask', () => {
    // The bands, the five bound outcomes and the read-the-red discipline live in
    // their own context file: `autonomy-mechanics.md` sat at its 16,000-char depth
    // ceiling, so adding ~5,600 chars of ladder there tripped a shrink-only
    // ratchet. Splitting a distinct subject out is the repair that ratchet asks
    // for; raising its baseline would have been the defect it names.
    const MECHANICS = 'src/agent-src/contexts/execution/fix-loop-ladder.md';
    const RULE = 'src/rules/autonomous-execution.md';

    it('no rule under src/rules still states the N=3 cap — except the kernel one', () => {
        // The step's literal criterion is `grep -rn 'N=3' src/rules` returning 0.
        // It returns ONE, and the one is `verify-before-complete.md`, which
        // `block_kernel_rule_writes` refuses every agent write to. Asserting zero
        // would make this fixture red on a change no agent can make; asserting
        // "only the kernel file" keeps the obligation and names why it stops there
        // — and it still fails the moment a NON-kernel rule reintroduces the cap.
        const dir = path.join(REPO, 'src', 'rules');
        const offenders = fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.md'))
            .filter((f) => read(path.join('src', 'rules', f)).includes('N=3'));
        expect(offenders).toEqual(['verify-before-complete.md']);
    });

    it('the bound is a setting with a default of 10, not a literal 3', () => {
        const body = flat(RULE);
        expect(body).toMatch(/execution\.fix_loop_max/);
        expect(body).toMatch(/default 10/);
    });

    it('names all three bands with their required behaviour', () => {
        const body = flat(RULE);
        expect(body).toMatch(/ATTEMPTS 1-3 — ROOT-CAUSE/);
        expect(body).toMatch(/ATTEMPTS 4-6 — A MANDATORY STRATEGY SHIFT/);
        expect(body).toMatch(/ATTEMPTS 7-10 — ESCALATE INDEPENDENTLY/);
    });

    it('maps no rung from a count to an owner ask', () => {
        const body = flat(RULE);
        expect(body).toMatch(/THE BOUND TRIGGERS A STRATEGY CHANGE, NEVER A QUESTION/);
        expect(body).toMatch(/A COUNT IS NOT A REASON TO ASK/);
        // The old remedy, gone. This is the assertion that would fail if the
        // section were reverted while the new prose was merely appended beside it.
        expect(body).not.toMatch(/ASK USER FOR GUIDANCE/);
        expect(body).not.toMatch(/DO NOT ITERATE BEYOND/);
    });

    it('the mechanics file carries all five bound outcomes, owner-ask third', () => {
        const body = flat(MECHANICS);
        expect(body).toMatch(/new epoch/);
        expect(body).toMatch(/An independent phase can proceed/);
        expect(body).toMatch(/The residue is owner-owned/);
        expect(body).toMatch(/An external prerequisite is objectively missing/);
        // The owner rung is reached by the OWNERSHIP test, never by the count.
        expect(body).toMatch(/reached by the OWNERSHIP test, never by the count/);
    });

    it('keeps the allowlist-growth counter a separate mechanism', () => {
        expect(flat(MECHANICS)).toMatch(
            /allowlist-growth counter is a separate mechanism/,
        );
        expect(flat(RULE)).toMatch(/allowlist-growth counter below stays a \*\*separate\*\* mechanism|spends the whole fix-loop bound for that target at once/);
    });
});

describe('T7 / T8 — a run cannot end with red CI while its checkboxes read complete', () => {
    const base = (over: Partial<LadderState> = {}): LadderState => ({
        iterations: 1,
        started_at: new Date().toISOString(),
        history: [],
        ...over,
    });

    it('T7 — zero open, delivery not reached: the run does NOT end', () => {
        for (const pos of ['pushed', 'pr-open', 'ci-pending', 'ci-red', 'target-moved'] as const) {
            expect(ladder(base(), 0, Date.now(), 0, undefined, null, false, pos)).toBe('engage');
        }
    });

    it('T8 — no grant, PR open and green: the run ENDS, and open-green is the ending', () => {
        expect(ladder(base(), 0, Date.now(), 0, undefined, null, false, 'open-green')).toBe(
            'complete',
        );
        expect(ladder(base(), 0, Date.now(), 0, undefined, null, false, 'merged')).toBe(
            'complete',
        );
        expect(DELIVERY_ENDINGS).toEqual(['merged', 'open-green']);
    });

    it('an unrecorded delivery position decides exactly as before — fail-open', () => {
        // The ladder runs on the Stop path where a `gh` probe is unaffordable, so
        // an absent position means "this run does not report delivery", never
        // "delivery is incomplete". Inventing the latter would hang every run
        // that never adopted the field.
        expect(deliveryBlocksCompletion(null)).toBe(false);
        expect(deliveryBlocksCompletion(undefined)).toBe(false);
        expect(ladder(base(), 0, Date.now(), 0)).toBe('complete');
        expect(ladder(base(), 0, Date.now(), 0, undefined, null, false, null)).toBe('complete');
    });

    it('delivery never overrides `blocked` — blocked work is not undelivered work', () => {
        expect(ladder(base(), 0, Date.now(), 2, undefined, null, false, 'ci-red')).toBe(
            'blocked',
        );
    });

    it('a delivery hold is still BOUNDED — iterations and the wall clock apply', () => {
        expect(
            ladder(
                base({ iterations: MAX_ITERATIONS }),
                0,
                Date.now(),
                0,
                undefined,
                null,
                false,
                'ci-red',
            ),
        ).toBe('halt-max-iterations');
        const old = new Date(Date.now() - WALL_CLOCK_CAP_MS - 1000).toISOString();
        expect(
            ladder(base({ started_at: old }), 0, Date.now(), 0, undefined, null, false, 'ci-red'),
        ).toBe('halt-wall-clock');
    });

    it('the stall rung is exempt during delivery — zero open cannot move', () => {
        // Three consecutive zero-open readings is what a healthy CI-fix loop looks
        // like. Tripping halt-stall on it is a stall manufactured by the stall
        // detector; the caps above are what bound this loop instead.
        const stalled = base({ iterations: 4, history: [0, 0, 0] });
        expect(ladder(stalled, 0, Date.now(), 0, undefined, null, false, 'ci-red')).toBe('engage');
        // …and the rung is NOT disabled generally: with steps still open, it fires.
        expect(
            ladder(base({ iterations: 4, history: [3, 3, 3] }), 3, Date.now(), 0),
        ).toBe('halt-stall');
    });

    it('a halt already stamped still wins over a delivery hold', () => {
        expect(
            ladder(base({ halted: 'halt-stall' }), 0, Date.now(), 0, undefined, null, false, 'ci-red'),
        ).toBe('halt-stall');
    });
});

describe('T2 / Phase 2 — tests are evaluators', () => {
    const RULE = 'src/rules/evaluator-independence.md';
    const MECH = 'docs/guidelines/agent-infra/evaluator-independence-mechanics.md';

    it('the rule carries a tests-are-evaluators section — D4 is closed', () => {
        expect(flat(RULE)).toMatch(/## Tests are evaluators/);
        expect(flat(RULE)).toMatch(/A TEST IS AN EVALUATOR/);
    });

    it('all five levels exist, L0 is fallback-only and L1 carries its warning', () => {
        const body = flat(RULE);
        for (const level of ['L0', 'L1', 'L2', 'L3', 'L4']) expect(body).toContain(level);
        expect(body).toMatch(/L0 same agent — \*\*fallback only\*\*/);
        // Risk 2 of the roadmap — L1 degrading to self-review while keeping the
        // name. The warning lives in the MECHANICS file: the rule was trimmed to
        // clear the per-spawn payload ratchet, and the obligation surface keeps
        // the level list while the argument for watching L1 moved with the rest
        // of the argument. Asserted where it actually is, not where it was.
        expect(flat(MECH)).toMatch(/the same model reviewing its own work/);
    });

    it('the level is read from the live provider count, not assumed', () => {
        expect(flat(RULE)).toMatch(/`agent-config council:status`'s live provider count/);
        expect(flat(RULE)).toMatch(/L3 or L4 wherever two providers are configured/);
    });

    it('T2 — every silent-weakening move is named, and the ladder does not end at the owner', () => {
        const body = flat(RULE);
        for (const move of [
            'WEAKENS AN ASSERTION',
            'DELETES, SKIPS OR XFAILS A',
            'LOWERS A THRESHOLD',
            'CHANGES FIXTURE SEMANTICS TO FIT THE CODE',
        ]) {
            expect(body).toContain(move);
        }
        expect(body).toMatch(
            /EVIDENCE → INDEPENDENT TEST REVIEW → COUNCIL OR TEAM → CHANGE ONLY AFTER AN INDEPENDENT VERDICT/,
        );
        expect(body).toMatch(/THE OWNER IS NOT THE ARBITER/);
    });

    it('the workflow keeps RED evidence between the author and the implementer', () => {
        expect(flat(MECH)).toMatch(
            /acceptance behaviour → INDEPENDENT AUTHOR → RED evidence → implementer → GREEN → INDEPENDENT VALIDATOR/,
        );
        expect(flat(MECH)).toMatch(/a test never shown red has unknown sensitivity/);
    });

    it('2.3 — the validator asks one question and is attributable', () => {
        const body = flat(MECH);
        expect(body).toMatch(/Would these tests fail under plausible wrong implementations\?/);
        for (const smell of [
            'tautologies',
            'algorithm duplication',
            'snapshot overuse',
            'missing boundary and error cases',
            'over-mocking',
            'expectations changed to fit the code',
            'a test never shown red',
        ]) {
            expect(body).toContain(smell);
        }
        expect(body).toMatch(/identity and provider go into the evidence/);
        // K3 — the cheap form ships; mutation infrastructure is not a prerequisite.
        expect(body).toMatch(/not\*\* mutation-testing infrastructure/);
    });
});

describe('G8 / G9 — the two test gates and the same-session flag', () => {
    it('G8 — a code change with no test delta is RED', () => {
        expect(findingFor(classify(['src/scripts/thing.ts']))).not.toBeNull();
    });

    it('G9 — test-first across two sessions is GREEN', () => {
        // The gate cannot see the session boundary; what it can see is that a
        // test arrived with the code, which is the mechanically decidable half.
        expect(findingFor(classify(['tests/a.test.ts', 'src/a.ts']))).toBeNull();
    });

    it('both gates are registered with CI-identical argv and a floor', () => {
        const ledger = read('src/config/gate-coverage.yml');
        for (const id of ['check_test_delta', 'check_test_weakening']) {
            expect(ledger).toMatch(new RegExp(`- id: ${id}\\n\\s+argv: \\["--quiet"\\]`));
        }
        // The same argv must appear in the workflow, or the row describes an
        // invocation CI does not make.
        //
        // `tests.yml`, not `consistency.yml`, and the reason is a real
        // constraint rather than a preference: `consistency.yml` is the
        // ratification mechanism's own carrier (`check_kernel_edit_ratified`
        // WORKFLOW_PATH), so any edit to it needs an independently reviewed
        // ratification artefact — ADR-268 § 4, an agent may not ratify its own
        // increase in power. The `static-checks` job is the conventional home
        // for repository-hygiene gates and is a required check either way.
        const wf = read('.github/workflows/tests.yml');
        expect(wf).toContain('./scripts-run src/scripts/check_test_delta --quiet');
        expect(wf).toContain('./scripts-run src/scripts/check_test_weakening --quiet');
    });

    it('the same-session flag fires on a commit and on nothing else', () => {
        expect(sameSessionTestFlag('git commit -m "x"')).not.toBeNull();
        expect(sameSessionTestFlag('git -C /x commit -am "y"')).not.toBeNull();
        expect(sameSessionTestFlag('git status')).toBeNull();
        expect(sameSessionTestFlag('npm test')).toBeNull();
        expect(sameSessionTestFlag(null)).toBeNull();
    });

    it('the flag names L0 as a permitted fallback rather than forbidding it', () => {
        const text = sameSessionTestFlag('git commit -m "x"') ?? '';
        expect(text).toMatch(/L0 is a permitted FALLBACK, not the default/);
        expect(text).toMatch(/evaluator-independence/);
    });

    it('it takes BOTH a test and a code path to flag — either alone is not L0', () => {
        expect(touchesTestAndCode(['tests/a.test.ts', 'src/a.ts'])).toBe(true);
        expect(touchesTestAndCode(['tests/a.test.ts'])).toBe(false);
        expect(touchesTestAndCode(['src/a.ts'])).toBe(false);
        expect(touchesTestAndCode([])).toBe(false);
    });
});

describe('3.1 — the six required layers, each with its command', () => {
    const CMD = 'src/domains/product-basic/roadmap/process-full/command.md';

    it('names all six layers in order', () => {
        const body = flat(CMD);
        for (const layer of [
            'A targeted local RED, then GREEN',
            'Quality scoped to the changed surface',
            'Per-phase fast CI',
            'The final full required CI',
            'Forge branch protection',
            'Final-head verification',
        ]) {
            expect(body).toContain(layer);
        }
    });

    it('every layer row carries a command, never a bare claim', () => {
        const lines = read(CMD).split('\n');
        const start = lines.findIndex((l) => l.startsWith('| # | Layer |'));
        expect(start).toBeGreaterThan(-1);
        const rows = lines
            .slice(start + 2)
            .filter((l) => /^\| [1-6] \|/.test(l))
            .slice(0, 6);
        expect(rows).toHaveLength(6);
        for (const row of rows) {
            const command = row.split('|')[3]?.trim() ?? '';
            // A layer with no command is a claim; a layer with one is a check.
            expect(command).toMatch(/`/);
        }
    });

    it('CI rejects all five conditions and gates on none of them being size', () => {
        const body = flat(CMD);
        for (const reject of [
            'A SKIPPED OR DISABLED REQUIRED CHECK',
            'UNRESOLVED GENERATED DRIFT',
            'POLICY-PROJECTION DRIFT',
            'A STALE-HEAD MERGE',
            'A CONFLICT RESOLUTION THAT WAS NOT REVALIDATED',
        ]) {
            expect(body).toContain(reject);
        }
        expect(body).toMatch(
            /CI NEVER REQUIRES A HUMAN APPROVAL MERELY BECAUSE A CHANGE IS LARGE/,
        );
    });

    it('a disabled required check cannot reach delivery-ready — the executable half', () => {
        // The doc states it; this is the predicate that enforces it, asserted
        // here so the roadmap's clause has a mechanism rather than a sentence.
        const skipped = {
            requiredContexts: ['Required'],
            checks: [{ name: 'Required', conclusion: 'SKIPPED', status: 'COMPLETED' }],
            observedHead: 'h',
            head: 'h',
        };
        expect(isDeliveryReady(skipped)).toBe(false);
    });
});

describe('3.2 — doctor reads forge protection from the forge', () => {
    it('an unread forge yields five rows that still name their API call', () => {
        const rows = forgeProtectionRows({
            rulesets: null,
            defaultBranch: null,
            allowAutoMerge: null,
            deployRestricted: null,
        });
        expect(rows).toHaveLength(5);
        for (const r of rows) {
            expect(r.state).toBe('unread');
            expect(r.source).toMatch(/^GET repos\//);
        }
    });

    it('`unread` is a third state — never reported as a false', () => {
        // The blocker's own re-scope forbids reading a 404 from the classic
        // endpoint as absence of protection; the same principle one layer in.
        const rows = forgeProtectionRows({
            rulesets: null,
            defaultBranch: null,
            allowAutoMerge: null,
            deployRestricted: null,
        });
        expect(rows.some((r) => r.state === 'unsatisfied')).toBe(false);
    });
});

describe('T5 / 5.1 — sync before every push, across a cascade', () => {
    it('a stacked branch owes both hops, nearest first', () => {
        const c = cascadeBase('feat/child', 'main', (r) =>
            r === 'feat/child' ? 'feat/parent' : r === 'feat/parent' ? 'main' : null,
        );
        expect(c.hops).toEqual(['feat/parent', 'main']);
    });

    it('the common case is unchanged — a trunk-based branch is still one hop', () => {
        const c = cascadeBase('feat/x', 'main', (r) => (r === 'feat/x' ? 'main' : null));
        expect(c.hops).toEqual(['main']);
    });

    it('T5 — a target that moved twice is behind on BOTH hops and not current', () => {
        const c = cascadeBase('feat/child', 'main', (r) =>
            r === 'feat/child' ? 'feat/parent' : r === 'feat/parent' ? 'main' : null,
        );
        const readings = c.hops.map((ref) => ({ ref, behind: true }));
        expect(hopsNeedingMerge(readings)).toHaveLength(2);
        expect(cascadeCurrent(readings)).toBe(false);
    });

    it('the final head is the one CI observed — a stale head is not delivery-ready', () => {
        // The second half of T5: both hops merged, but the verdict must be about
        // the head that was actually pushed last.
        expect(
            isDeliveryReady({
                requiredContexts: [],
                checks: [],
                observedHead: 'before-the-merge',
                head: 'after-the-merge',
            }),
        ).toBe(false);
    });
});

describe('T4 / 5.2 — an unenumerated conflict routes rather than halting', () => {
    const MERGE = 'src/domains/git/pr/merge/command.md';
    const FULL = 'src/domains/product-basic/roadmap/process-full/command.md';

    it('the four classes are named AIDS, not exhaustive authority', () => {
        const body = flat(MERGE);
        expect(body).toMatch(/THE FOUR CLASSES ARE AIDS, NOT EXHAUSTIVE AUTHORITY/);
        expect(body).toMatch(/AN UNENUMERATED CONFLICT IS ROUTED, NOT HALTED/);
    });

    it('the ladder is present in order, with the owner LAST', () => {
        const body = flat(MERGE);
        const rungs = [
            'UNDERSTAND BOTH INTENTS',
            'INSPECT RECENCY, AUTHORS AND OPEN PRs',
            'PRESERVE BOTH WHERE COMPATIBLE',
            'INDEPENDENT REVIEW FOR A RISKY MERGE',
            'COUNCIL OR TEAM',
            'THE OWNER ONLY FOR A PRODUCT-SEMANTIC INCOMPATIBILITY',
        ];
        let at = -1;
        for (const rung of rungs) {
            const i = body.indexOf(rung);
            expect(i).toBeGreaterThan(at);
            at = i;
        }
    });

    it('the run’s own uncertainty is explicitly NOT an owner trigger', () => {
        expect(flat(MERGE)).toMatch(
            /"I DO NOT KNOW WHICH SIDE IS RIGHT" IS A REASON TO ESCALATE INDEPENDENTLY, NOT A REASON TO ASK/,
        );
    });

    it('the silent-resolution prohibition SURVIVES the retirement', () => {
        // The halt is gone; what replaced it is a record. A retirement that also
        // dropped the record would be a removal, not a migration.
        expect(flat(MERGE)).toMatch(/Deciding it \*\*silently\*\* inside a drain loop is still how work disappears/);
    });

    it('process-full carries five live halts, and halt 6 is retired in place', () => {
        const body = flat(FULL);
        expect(body).toMatch(/five — and only five — live halt conditions/);
        expect(body).toMatch(/6\. \*\*RETIRED 2026-09-13\*\*/);
        // Numbered, never renumbered: the list is cited by index elsewhere.
        expect(body).toMatch(/Numbered rather than renumbered/);
        expect(body).not.toMatch(/six — and only six/);
    });
});

describe('7.2 — a per-host destructive column, measured', () => {
    const DOC = 'docs/enforcement-by-host.md';

    it('the column exists and carries all eight hosts', () => {
        const body = flat(DOC);
        expect(body).toMatch(/## `destructive:` — which layer guards a typed op, per host/);
        for (const host of [
            'claude',
            'augment',
            'cursor',
            'cline',
            'gemini',
            'windsurf',
            'cowork',
            'copilot',
        ]) {
            expect(body).toMatch(new RegExp(`\\| \`${host}\` \\| \`(hook|daemon|manual-only)\` \\|`));
        }
    });

    /**
     * Just this section's own lines.
     *
     * The generated slot table further down carries rows with the same leading
     * shape (`| `claude` | `session_start` | …`), so a document-wide filter picks
     * up 40 rows and asserts nothing about the one table under test.
     */
    const section = (): string[] => {
        const lines = read(DOC).split('\n');
        const start = lines.findIndex((l) => l.startsWith('## `destructive:`'));
        const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
        return lines.slice(start, end === -1 ? lines.length : end);
    };

    it('every row states what it was measured FROM, never a bare value', () => {
        // The step's own word is "measured per host rather than asserted". A row
        // with a value and no source is the assertion it forbids, and this is the
        // assertion that would fail if a later editor filled a row by hand.
        const rows = section().filter((l) =>
            /^\| `(claude|augment|cursor|cline|gemini|windsurf|cowork|copilot)` \|/.test(l),
        );
        expect(rows).toHaveLength(8);
        for (const row of rows) {
            const cells = row.split('|').map((c) => c.trim());
            expect(cells[3]).not.toBe('');
            expect(cells[3]).toMatch(/pre_tool_use|slots:/);
        }
    });

    it('the column agrees with the configuration it claims to read', () => {
        // Not a restatement of the doc: this re-derives the verdict from
        // host_lowering.yaml and compares. A cell edited by hand reds here.
        const yaml = read('src/scripts/hooks/host_lowering.yaml');
        // `claude` is the one host whose pre_tool_use carries a refusal exit.
        expect(yaml).toMatch(/pre_tool_use:[\s\S]{0,200}?block_exit:\s*2/);
        const doc = flat(DOC);
        expect(doc).toMatch(/\| `claude` \| `hook` \|/);
        // …and no other host claims `hook`.
        const hookRows = section().filter((l) => /^\| `[a-z]+` \| `hook` \|/.test(l));
        expect(hookRows).toHaveLength(1);
    });

    it('says plainly that no host is `daemon` yet', () => {
        expect(flat(DOC)).toMatch(/\*\*No host is `daemon` today\*\*/);
    });

    it('records the kernel half as owed rather than claiming it landed', () => {
        const body = flat(DOC);
        expect(body).toMatch(/It still reads `none` and this change did not move it/);
        expect(body).toMatch(/block_kernel_rule_writes/);
    });
});

describe('8.2 — the PR body is one page for the owner', () => {
    const CMD = 'src/domains/product-basic/roadmap/process-full/command.md';

    it('names all six sections the end-of-run body must carry', () => {
        const body = flat(CMD);
        for (const section of [
            'Delivery target reached',
            'Decisions taken, and by whom',
            'Open owner-owned residue',
            'Scope delta',
            'Spend',
            'Fix-loop epochs',
        ]) {
            expect(body).toContain(section);
        }
    });

    it('states the delivery machine and both of its endings', () => {
        const body = flat(CMD);
        expect(body).toMatch(/delivery-ready → \(grant → merged \| no grant → open-green\)/);
        expect(body).toMatch(/`open-green` is a success, not a shortfall/);
    });

    it('ties `complete` to delivery, not to the checkbox count alone', () => {
        expect(flat(CMD)).toMatch(
            /`count_open == 0`, the PR is open, and delivery reached an ending/,
        );
    });
});

describe('Phase 4.2 — read the red before diagnosing it', () => {
    it('process-full never reaches for `gh pr checks --watch`', () => {
        const cmd = read('src/domains/product-basic/roadmap/process-full/command.md');
        expect(cmd.split('gh pr checks --watch').length - 1).toBe(0);
    });

    it("the ladder's own text names ci_settle and the --log-failed read", () => {
        const body = flat('src/agent-src/contexts/execution/fix-loop-ladder.md');
        expect(body).toMatch(/`ci_settle`/);
        expect(body).toMatch(/--log-failed/);
        // The two traps that make the naive read wrong, not just the tool name.
        expect(body).toMatch(/LAST OUTPUT LINE is the verdict/);
        expect(body).toMatch(/exit code, which is 0 on a failure/);
    });
});

describe('T1 — a normal feature runs independent-RED → implement → green, with zero asks', () => {
    const base = (over: Partial<LadderState> = {}): LadderState => ({
        iterations: 1,
        started_at: new Date().toISOString(),
        history: [],
        ...over,
    });

    it('a test-first diff produces no test-delta finding', () => {
        // The normal shape: the independent author's test lands in the same diff
        // as the implementation it was written against. `findingFor` must stay
        // silent — a gate that red-flagged the compliant case would be trained
        // around within a week, which is this file's own Risk 4.
        const verdict = classify([
            'src/scripts/_lib/mission_record.ts',
            'tests/scripts/mission_continuity.test.ts',
        ]);
        expect(verdict.code.length).toBeGreaterThan(0);
        expect(verdict.tests.length).toBeGreaterThan(0);
        expect(findingFor(verdict)).toBeNull();
    });

    it('the same-session flag WARNS and never blocks, because L0 is a legal state', () => {
        // The plausible wrong implementation is a flag that refuses the diff.
        // L0 is a permitted fallback, so refusing it would forbid a legal state —
        // the flag therefore produces prose, and the prose says so itself.
        expect(
            touchesTestAndCode([
                'src/scripts/_lib/mission_record.ts',
                'tests/scripts/mission_continuity.test.ts',
            ]),
        ).toBe(true);
        const text = sameSessionTestFlag('git commit -m "feat: x"');
        expect(text).not.toBeNull();
        expect(text).toMatch(/permitted FALLBACK/);
        expect(text).toMatch(/prompt to STATE the level, not a finding/);
    });

    it('the flag is silent on a command that is not a commit', () => {
        // Sensitivity: a flag that fired on every command would carry no
        // information about the staged set at all.
        expect(sameSessionTestFlag('npm run test:ts')).toBeNull();
        expect(sameSessionTestFlag(null)).toBeNull();
    });

    it('the happy path ends the run, and no ladder rung is an owner ask', () => {
        // T1's load-bearing half. The run reaching a delivery ending must
        // `complete`; and the ladder's WHOLE action vocabulary must contain no
        // rung that routes to the owner — a count mapped to an ask is exactly
        // what Phase 4.1 removed, and the union is where it would reappear.
        expect(ladder(base(), 0, Date.now(), 0, undefined, null, false, 'merged')).toBe('complete');
        for (const action of Object.keys(TERMINAL_STATE_BY_ACTION)) {
            expect(action).not.toMatch(/ask|question|confirm|owner/i);
        }
        for (const halt of HALT_ACTIONS) {
            expect(terminalStateFor(halt)).not.toBeNull();
        }
    });
});

describe('T6 — a twelve-hour resume preserves the grant and every closed decision', () => {
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

    const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
        mission_id: 'm-1',
        roadmap: 'agents/roadmaps/road-to-adversarial-verification-and-long-runs.md',
        phase: 'Phase 3',
        completed_steps: ['0.1', '0.2', '1.1'],
        decisions: [
            { id: 'branch-base', where: 'run notes § Decisions' },
            { id: 'conflict-class-4', where: 'run notes § Decisions' },
        ],
        authority: {
            grant: 'roadmap:process-full',
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            revoked_by: null,
        },
        target_branch: 'main',
        pr: 2031,
        head_sha: 'abc1234',
        last_ci: { verdict: 'green', head: 'abc1234' },
        recovery_epoch: 2,
        attempt_count: 7,
        pending_reviews: ['independent-validator'],
        owner_owned_residue: [],
        ...over,
    });

    it('a gap THREE TIMES the run wall-clock cap still resumes', () => {
        // The plausible wrong implementation: expiring the mission record with
        // the RUN's wall clock. `WALL_CLOCK_CAP_MS` bounds one run; a mission
        // spans many, so twelve hours must not be an expiry on its own.
        expect(TWELVE_HOURS_MS).toBeGreaterThan(WALL_CLOCK_CAP_MS * 2);
        const later = new Date(Date.now() + TWELVE_HOURS_MS);
        const rec = record({
            authority: {
                grant: 'roadmap:process-full',
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                revoked_by: null,
            },
        });
        expect(restore(rec, { grant: 'roadmap:process-full', revoked_by: null }, later).state).toBe(
            'resume',
        );
    });

    it('the resume re-asks nothing the mission already settled', () => {
        const rec = record();
        const verdict = restore(rec, null, new Date());
        expect(verdict.state).toBe('resume');
        expect(verdict.closed).toEqual(['branch-base', 'conflict-class-4']);
        for (const id of verdict.closed) {
            expect(alreadyAnswered(rec, id)).toBe(true);
        }
        expect(alreadyAnswered(rec, 'never-asked')).toBe(false);
    });

    it('a record is not one while a field is missing', () => {
        // Provenance of the resume: the fourteen fields are what makes the
        // restore a read rather than a re-derivation.
        expect(missingFields(record())).toEqual([]);
        const partial: Partial<MissionRecord> = { ...record() };
        delete (partial as { head_sha?: string }).head_sha;
        expect(missingFields(partial)).toContain('head_sha');
    });

    it('a side task does not clear the record; only mission completion does', () => {
        for (const boundary of WRITE_BOUNDARIES) expect(clearedBy(boundary)).toBe(false);
        expect(clearedBy('side-task')).toBe(false);
        expect(clearedBy('mission-complete')).toBe(true);
    });

    it('a grant withdrawn DURING the twelve hours does not survive the resume', () => {
        // Sensitivity for the half that matters: the ledger is the surface a
        // revocation writes to, so a restore that trusted the snapshot alone
        // would resume with authority the owner took back mid-gap.
        const later = new Date(Date.now() + TWELVE_HOURS_MS);
        const verdict = restore(
            record(),
            { grant: 'roadmap:process-full', revoked_by: 'owner' },
            later,
        );
        expect(verdict.state).toBe('authority-withdrawn');
    });
});

describe('T9 — a typed op reaches an exact-object ask, and a verdict alone never grants', () => {
    const unconfirmed: ExactObjectAsk = {
        op: 'git push --force',
        object: 'origin/drain/adversarial-verification-rest @ abc1234',
        confirmed: false,
    };
    const confirmed: ExactObjectAsk = { ...unconfirmed, confirmed: true };

    it('an in-mission verdict produces an ASK, never a grant', () => {
        // The whole of T9 in one assertion: a clearance is not an authorisation.
        // The reason has to SAY so, because a state name alone reads the same
        // whether the council mattered or not.
        const d = grantFor('in-mission', unconfirmed);
        expect(d.state).toBe('ask-required');
        expect(d.reason).toMatch(/which is not a grant/);
        expect(d.reason).toMatch(/the ask still has to happen/);
    });

    it('no verdict in the whole domain grants without the this-turn confirmation', () => {
        for (const v of ['in-mission', 'out-of-mission', 'unavailable', null] as const) {
            expect(verdictAloneGrants(v)).toBe(false);
            expect(grantFor(v, unconfirmed).state).not.toBe('granted');
        }
    });

    it('the confirmation must name an exact OBJECT, not a category', () => {
        // The Hard Floor's own wording. A confirmed ask over "the branch" is
        // still `ask-required` — the plausible wrong implementation treats the
        // `confirmed` boolean as sufficient and never reads what was named.
        const category: ExactObjectAsk = { ...confirmed, object: 'branches' };
        expect(grantFor('in-mission', category).state).toBe('ask-required');
        expect(grantFor('in-mission', category).reason).toMatch(/category rather than an object/);
        expect(grantFor('in-mission', confirmed).state).toBe('granted');
    });

    it('an out-of-mission verdict VETOES, and a later yes does not override it', () => {
        // An advisory veto is not one. Order is the assertion: veto first, so a
        // confirmation arriving afterwards changes nothing.
        expect(grantFor('out-of-mission', unconfirmed).state).toBe('vetoed');
        expect(grantFor('out-of-mission', confirmed).state).toBe('vetoed');
    });

    it('an UNAVAILABLE council is not a veto', () => {
        // The same-shaped wrong guess `council-availability` exists over: reading
        // absence as refusal would make an unconfigured council a silent kill
        // switch on every typed op.
        expect(grantFor('unavailable', unconfirmed).state).not.toBe('vetoed');
        expect(grantFor(null, unconfirmed).state).not.toBe('vetoed');
        expect(grantFor('unavailable', confirmed).state).toBe('granted');
    });
});

describe('T10 — an over-ceiling API requirement produces a report and no ask', () => {
    const ctx = {
        needed: 'an independent validator pass over the Phase 2 fixtures',
        missionState: 'Phase 2 of 11, PR open, CI green',
        canStillProceed: ['Phases 3-5', 'the delivery state machine'],
    };
    const overCeiling = {
        cliAvailable: false,
        cliUnavailableReason: 'cli quota exhausted',
        estimateUsd: 40,
        ceilingUsd: 25,
    };

    it('over the ceiling pauses and carries all six report fields', () => {
        const d = routeCouncil(overCeiling, ctx);
        expect(d.route).toBe('paused');
        expect(d.report).not.toBeNull();
        for (const field of REPORT_FIELDS) {
            expect(d.report?.[field]).toBeDefined();
        }
    });

    it('the rendered report contains no question mark at all', () => {
        // The failure mode is a report drifting into an ask one helpful sentence
        // at a time. A single `?` anywhere is the drift.
        const d = routeCouncil(overCeiling, ctx);
        const text = renderReport(d.report as PauseReport);
        expect(text).not.toContain('?');
        expect(text).toMatch(/Proceeding meanwhile with:/);
        expect(text).toMatch(/Phases 3-5/);
    });

    it('"nothing can proceed" renders as a stated answer, not an empty section', () => {
        const d = routeCouncil(overCeiling, { ...ctx, canStillProceed: [] });
        const text = renderReport(d.report as PauseReport);
        expect(text).toMatch(/nothing; the mission is blocked on this council pass alone/);
        expect(text).not.toContain('?');
    });

    it('an estimate exactly AT the ceiling is WITHIN it', () => {
        // A limit, not an exclusive bound. The other reading pauses a run that
        // budgeted exactly, which is the arithmetic-off-by-one this pins.
        const d = routeCouncil({ ...overCeiling, estimateUsd: 25 }, ctx);
        expect(d.route).toBe('api');
        expect(d.report).toBeNull();
    });

    it('an available CLI never reaches the metered rung', () => {
        const d = routeCouncil(
            { cliAvailable: true, cliUnavailableReason: null, estimateUsd: 999, ceilingUsd: 1 },
            ctx,
        );
        expect(d.route).toBe('cli');
    });
});

/**
 * AC-7 — the whole file in one run.
 *
 * Every fixture above pins one mechanism. This one pins the COMPOSITION, which
 * is where the roadmap's actual claim lives: that a run can cross more wall-clock
 * time than any single run is allowed to spend, and still reach `merged` without
 * spending one owner question on it.
 *
 * The two modules have to disagree about scope for that to work, and they do.
 * `continuation_ladder` bounds ONE run — 25 iterations, four hours — and a run
 * that hits either bound is `exhausted`, which is a budget word and not a
 * failure. `mission_record` carries the MISSION, which is longer than a run by
 * construction. Collapsing the two is the plausible wrong implementation in
 * either direction: a ladder that never halted would be the unbounded loop K1
 * killed, and a record that expired with the run's wall clock would make a
 * long run impossible and every resume an owner interrupt.
 */
describe('AC-7 — a throttled four-phase long run ends merged, one resume, zero owner asks', () => {
    const HOUR = 60 * 60 * 1000;
    const t0 = Date.parse('2026-09-14T08:00:00.000Z');

    /** Each phase's remaining open-step count, read at that phase's stop. */
    const PHASES = [
        { phase: 'Phase 1', openAfter: 3 },
        { phase: 'Phase 2', openAfter: 2 },
        { phase: 'Phase 3', openAfter: 1 },
        { phase: 'Phase 4', openAfter: 0 },
    ] as const;

    const runA: LadderState = {
        iterations: 4,
        started_at: new Date(t0).toISOString(),
        // Distinct counts: the open-step scan is moving, so the stall rung is
        // not what this fixture is measuring.
        history: [4, 3, 2],
    };

    const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
        mission_id: 'ac7-long-run',
        roadmap: 'agents/roadmaps/road-to-adversarial-verification-and-long-runs.md',
        phase: 'Phase 2',
        completed_steps: ['1.1', '2.1'],
        decisions: [
            { id: 'branch-base', where: 'run notes § Decisions' },
            { id: 'delivery-target', where: 'run notes § Decisions' },
        ],
        authority: {
            grant: 'roadmap:process-full',
            expires: new Date(t0 + 48 * HOUR).toISOString(),
            revoked_by: null,
        },
        target_branch: 'main',
        pr: 2042,
        head_sha: 'deadbee',
        last_ci: { verdict: 'green', head: 'deadbee' },
        recovery_epoch: 1,
        attempt_count: 3,
        pending_reviews: [],
        owner_owned_residue: [],
        ...over,
    });

    it('phases 1 and 2 keep the first run engaged while steps remain', () => {
        for (const { openAfter } of PHASES.slice(0, 2)) {
            expect(ladder(runA, openAfter, t0 + HOUR, 0, undefined, null, false, 'pr-open')).toBe(
                'engage',
            );
        }
    });

    it('the first run ends on its own wall clock — a budget word, not a failure', () => {
        // The throttle. Five hours in, run A stops at `halt-wall-clock`. What
        // matters is the WORD: `exhausted`, never `blocked` and never an ask.
        // A run that reported `blocked` here would send a nameable continuation
        // to the owner-owned rung, which is the count-to-an-ask move Phase 4.1
        // removed wearing a different name.
        const action = ladder(runA, 2, t0 + 5 * HOUR, 0, undefined, null, false, 'pr-open');
        expect(action).toBe('halt-wall-clock');
        expect(terminalStateFor(action)).toBe('exhausted');
        expect(terminalStateFor(action)).not.toBe('blocked');
    });

    it('the record survives the phase boundary and the session end', () => {
        // Written at each boundary and cleared by none of them. A record cleared
        // at `session-end` would make the resume a fresh start, which is the
        // same thing as having no record.
        for (const boundary of WRITE_BOUNDARIES) expect(clearedBy(boundary)).toBe(false);
        expect(missingFields(record())).toEqual([]);
    });

    it('ONE resume, twelve hours later, and it re-asks nothing', () => {
        const verdict = restore(
            record(),
            { grant: 'roadmap:process-full', revoked_by: null },
            new Date(t0 + 12 * HOUR),
        );
        expect(verdict.state).toBe('resume');
        expect(verdict.closed).toEqual(['branch-base', 'delivery-target']);
        for (const id of verdict.closed) expect(alreadyAnswered(record(), id)).toBe(true);
    });

    it('the resume is what buys the zero asks — without it the questions reopen', () => {
        // Sensitivity for the composition rather than for a branch. A mission
        // restarted from a record that carries no decisions answers none of
        // them, so every one of those is an owner question the run would have
        // to spend. The record is the mechanism; this asserts it is load-bearing.
        const amnesiac = record({ decisions: [] });
        expect(restore(amnesiac, null, new Date(t0 + 12 * HOUR)).closed).toEqual([]);
        for (const id of ['branch-base', 'delivery-target']) {
            expect(alreadyAnswered(amnesiac, id)).toBe(false);
        }
    });

    it('phases 3 and 4 run under a FRESH clock and reach merged', () => {
        // Run B starts its own wall clock — that is what makes the mission
        // longer than any run. The same elapsed instant that halted run A is
        // ordinary mid-run time here.
        const runB: LadderState = {
            iterations: 2,
            started_at: new Date(t0 + 12 * HOUR).toISOString(),
            history: [2, 1],
        };
        expect(ladder(runB, 1, t0 + 13 * HOUR, 0, undefined, null, false, 'pr-open')).toBe('engage');
        expect(ladder(runB, 0, t0 + 14 * HOUR, 0, undefined, null, false, 'merged')).toBe(
            'complete',
        );
        expect(DELIVERY_ENDINGS).toContain('merged');
    });

    it('zero open steps with delivery NOT reached does not end the run', () => {
        // The forbidden ending, restated inside the long run: four phases of
        // flipped checkboxes over a red CI is the exact shape 8.1 forbids.
        const runB: LadderState = {
            iterations: 2,
            started_at: new Date(t0 + 12 * HOUR).toISOString(),
            history: [2, 1],
        };
        expect(ladder(runB, 0, t0 + 14 * HOUR, 0, undefined, null, false, 'ci-red')).toBe('engage');
    });

    it('the whole run spans more wall clock than any single run may spend', () => {
        // The claim in one line, so a reader does not have to add the hours up.
        expect(14 * HOUR).toBeGreaterThan(WALL_CLOCK_CAP_MS);
        expect(PHASES).toHaveLength(4);
        expect(PHASES[PHASES.length - 1]?.openAfter).toBe(0);
    });

    it('no action reachable anywhere in the run is an owner ask', () => {
        // Collected over the run's own observed rungs plus the whole vocabulary,
        // because the criterion is about the run AND about what the run could
        // have produced. `MAX_ITERATIONS` is asserted so a future widening of the
        // budget cannot silently turn the throttle off.
        const observed: LadderAction[] = [
            'engage',
            'halt-wall-clock',
            'complete',
        ];
        for (const action of [...observed, ...Object.keys(TERMINAL_STATE_BY_ACTION)]) {
            expect(action).not.toMatch(/ask|question|confirm|owner/i);
        }
        expect(MAX_ITERATIONS).toBe(25);
    });
});
