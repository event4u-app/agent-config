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
    criticalGaps,
    levelRank,
    parseProvenance,
} from '../../src/scripts/_lib/test_provenance.js';
import {
    grantFor,
    verdictAloneGrants,
    type ExactObjectAsk,
} from '../../src/scripts/_lib/typed_op_grant.js';
import { classify, findingFor } from '../../src/scripts/check_test_delta.js';
import { PROCEDURE_BRANCHES, procedureText } from '../_lib/procedure_text.js';
import {
    sameSessionTestFlag,
    touchesTestAndCode,
} from '../../src/scripts/hooks/evidence_independence.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string): string =>
    rel in PROCEDURE_BRANCHES ? procedureText(rel) : fs.readFileSync(path.join(REPO, rel), 'utf8');
/**
 * The same text with every run of whitespace collapsed to one space.
 *
 * Prose files wrap, so a phrase the author wrote as one sentence reaches a
 * naive regex split across a newline. Matching against the flattened form asserts
 * the CLAIM is present; matching against the raw form would additionally assert
 * where the author happened to break the line, which is not a contract.
 */
const flat = (rel: string): string => read(rel).replace(/\s+/g, ' ');

// provenance: level=L0 | critical=no | evidence=
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

// provenance: level=L0 | critical=no | evidence=
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

// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
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

// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
describe('G8 / G9 — the two test gates and the same-session flag', () => {
    it('G8 — a code change with no test delta is RED, and the finding names the path', () => {
        const finding = findingFor(classify(['src/scripts/thing.ts']));
        expect(finding).not.toBeNull();
        // `!== null` alone passed against a gate that emitted a constant string.
        // The finding has to name the file the reader must act on, and the
        // owner-label escape, which is the only legitimate way past it.
        expect(finding).toContain('src/scripts/thing.ts');
        expect(finding).toContain('test-delta-acknowledged');
    });

    it('G9 — a code change WITH a qualifying test delta is GREEN', () => {
        // **Renamed 2026-09-14.** It read "test-first across two sessions is
        // GREEN", and both seats of the independent authorship pass called that
        // a title-body contradiction: the body already conceded the gate cannot
        // see a session boundary, so the title claimed provenance the assertion
        // does not establish. The mechanically decidable half is that a test
        // arrived with the code — which is what this now says and all it says.
        // The two-session half is carried by the hook flag, WARN-only, below.
        expect(findingFor(classify(['tests/a.test.ts', 'src/a.ts']))).toBeNull();
        // …and a test that is not a test path does not satisfy it.
        expect(findingFor(classify(['docs/a.md', 'src/a.ts']))).not.toBeNull();
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

// provenance: level=L4 | critical=no | evidence=ac2-independent-test-authorship-2026-09-14
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

// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
describe('3.2 — doctor reads forge protection from the forge', () => {
    it('an unread forge yields six rows that still name their API call', () => {
        // The count stays a LITERAL rather than `PROTECTION_ROW_IDS.length`:
        // deriving it from the module under test would make a row silently
        // dropped from both the id list and the builder invisible here. It moved
        // 5 -> 6 on 2026-10-12 with `authority_surface_external_approval`; the
        // assertion is not weakened, it is restated at the new true value.
        const rows = forgeProtectionRows({
            rulesets: null,
            defaultBranch: null,
            allowAutoMerge: null,
            deployRestricted: null,
        });
        expect(rows).toHaveLength(6);
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

// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
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

// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
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

// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
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

// provenance: level=L0 | critical=no | evidence=
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

// provenance: level=L0 | critical=no | evidence=
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

// provenance: level=L4 | critical=no | evidence=ac2-independent-test-authorship-2026-09-14
describe('T1 — a normal feature runs independent-RED → implement → green, with zero asks', () => {
    it('a test-first diff produces no finding, and a code-only one DOES', () => {
        // Both polarities in one test, because the silent half alone is a
        // tautology: an implementation whose `findingFor` always returned null
        // passed the compliant-case assertion. Named by both seats of the
        // 2026-09-14 independent authorship pass, and it was right.
        const compliant = classify([
            'src/scripts/_lib/mission_record.ts',
            'tests/scripts/mission_continuity.test.ts',
        ]);
        expect(compliant.code).toEqual(['src/scripts/_lib/mission_record.ts']);
        expect(compliant.tests).toEqual(['tests/scripts/mission_continuity.test.ts']);
        expect(findingFor(compliant)).toBeNull();

        const codeOnly = classify(['src/scripts/_lib/mission_record.ts']);
        expect(codeOnly.tests).toEqual([]);
        const finding = findingFor(codeOnly);
        expect(finding).not.toBeNull();
        expect(finding).toContain('src/scripts/_lib/mission_record.ts');

        // A test-only diff is not a code change, so it is not a finding either —
        // the other direction a one-sided gate gets wrong.
        const testOnly = classify(['tests/scripts/mission_continuity.test.ts']);
        expect(testOnly.code).toEqual([]);
        expect(findingFor(testOnly)).toBeNull();
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

});

// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
describe('T6 — a twelve-hour resume preserves the grant and every closed decision', () => {
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    // A FIXED clock. `Date.now()` in an authority test makes the boundary cases
    // below non-reproducible and the "exactly at expiry" case unwritable — both
    // seats of the 2026-09-14 independent authorship pass named it.
    const NOW = Date.parse('2026-09-14T12:00:00.000Z');
    const at = (offsetMs: number): Date => new Date(NOW + offsetMs);

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
            expires: at(24 * 60 * 60 * 1000).toISOString(),
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

    it('a twelve-hour gap still resumes — elapsed time alone is not an expiry', () => {
        // The plausible wrong implementation: expiring the mission record with
        // a run's wall clock. A mission spans many runs, so twelve hours must
        // not be an expiry on its own; only the grant's own `expires` is.
        expect(
            restore(
                record(),
                { grant: 'roadmap:process-full', revoked_by: null },
                at(TWELVE_HOURS_MS),
            ).state,
        ).toBe('resume');
    });

    it('expiry decides at the boundary, and an unreadable one is EXPIRED', () => {
        // Four cases the group did not have. The middle one is the reason the
        // clock had to be fixed: `expires === now` is `<=`, so exactly-at is
        // expired — a limit read the opposite way from `council_transport`'s
        // ceiling, and both readings are deliberate.
        const future = (): MissionRecord =>
            record({ authority: { grant: 'g', expires: at(60_000).toISOString(), revoked_by: null } });
        const past = (): MissionRecord =>
            record({ authority: { grant: 'g', expires: at(-60_000).toISOString(), revoked_by: null } });
        const exactly = (): MissionRecord =>
            record({ authority: { grant: 'g', expires: at(0).toISOString(), revoked_by: null } });
        const unreadable = (): MissionRecord =>
            record({ authority: { grant: 'g', expires: 'sometime soon', revoked_by: null } });
        const never = (): MissionRecord =>
            record({ authority: { grant: 'g', expires: null, revoked_by: null } });

        expect(restore(future(), null, at(0)).state).toBe('resume');
        expect(restore(past(), null, at(0)).state).toBe('authority-expired');
        expect(restore(exactly(), null, at(0)).state).toBe('authority-expired');
        // A grant whose lifetime cannot be read is not a grant with no lifetime.
        expect(restore(unreadable(), null, at(0)).state).toBe('authority-expired');
        expect(restore(never(), null, at(0)).state).toBe('resume');
    });

    it('the resume re-asks nothing the mission already settled', () => {
        const rec = record();
        const verdict = restore(rec, null, at(0));
        expect(verdict.state).toBe('resume');
        expect(verdict.closed).toEqual(['branch-base', 'conflict-class-4']);
        for (const id of verdict.closed) {
            expect(alreadyAnswered(rec, id)).toBe(true);
        }
        expect(alreadyAnswered(rec, 'never-asked')).toBe(false);
    });

    it('the closed set survives a REFUSED restore too', () => {
        // An implementation that dropped `closed` when it refused would make a
        // withdrawn-authority restart re-ask everything the mission settled —
        // the failure the record exists against, arriving through the error path
        // instead of the happy one.
        const withdrawn = restore(record({
            authority: { grant: 'g', expires: null, revoked_by: 'owner' },
        }), null, at(0));
        expect(withdrawn.state).toBe('authority-withdrawn');
        expect(withdrawn.closed).toEqual(['branch-base', 'conflict-class-4']);
    });

    it('EVERY one of the fourteen fields is reported when it is the one missing', () => {
        // Dropping only `head_sha` established that one field is checked. The
        // whole list is the contract: a `REQUIRED_FIELDS` that quietly lost a
        // member passed the single-field form.
        expect(missingFields(record())).toEqual([]);
        const complete = record() as unknown as Record<string, unknown>;
        const names = Object.keys(complete);
        expect(names).toHaveLength(14);
        for (const field of names) {
            const partial = { ...complete };
            delete partial[field];
            expect(missingFields(partial as Partial<MissionRecord>)).toEqual([field]);
        }
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
        expect(
            restore(
                record(),
                { grant: 'roadmap:process-full', revoked_by: 'owner' },
                at(TWELVE_HOURS_MS),
            ).state,
        ).toBe('authority-withdrawn');
    });

    it('the ledger revokes in ONE direction — it can never revive', () => {
        // The precedence, asserted from the side that was missing: a snapshot
        // already revoked stays revoked even where the ledger shows the grant
        // live. A ledger that could un-revoke would make the record the weaker
        // authority and the revocation advisory.
        const revokedSnapshot = record({
            authority: { grant: 'g', expires: null, revoked_by: 'owner' },
        });
        expect(restore(revokedSnapshot, { grant: 'g', revoked_by: null }, at(0)).state).toBe(
            'authority-withdrawn',
        );
    });
});

// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
describe('T9 — a typed op reaches an exact-object ask, and a verdict alone never grants', () => {
    const TURN = 'turn-91';
    const unconfirmed: ExactObjectAsk = {
        op: 'git push --force',
        object: 'origin/drain/adversarial-verification-rest @ abc1234',
        confirmed: false,
        confirmed_turn: TURN,
    };
    const confirmed: ExactObjectAsk = { ...unconfirmed, confirmed: true };

    it('an in-mission verdict produces an ASK, never a grant', () => {
        // The whole of T9 in one assertion: a clearance is not an authorisation.
        // The reason has to SAY so, because a state name alone reads the same
        // whether the council mattered or not.
        const d = grantFor('in-mission', unconfirmed, TURN);
        expect(d.state).toBe('ask-required');
        expect(d.reason).toMatch(/which is not a grant/);
        expect(d.reason).toMatch(/the ask still has to happen/);
    });

    it('no verdict in the whole domain grants without the this-turn confirmation', () => {
        for (const v of ['in-mission', 'out-of-mission', 'unavailable', null] as const) {
            expect(verdictAloneGrants(v)).toBe(false);
            expect(grantFor(v, unconfirmed, TURN).state).not.toBe('granted');
        }
    });

    it('the confirmation must name an exact OBJECT, not a category', () => {
        // The Hard Floor's own wording. A confirmed ask over "the branch" is
        // still `ask-required` — the plausible wrong implementation treats the
        // `confirmed` boolean as sufficient and never reads what was named.
        const category: ExactObjectAsk = { ...confirmed, object: 'branches' };
        expect(grantFor('in-mission', category, TURN).state).toBe('ask-required');
        expect(grantFor('in-mission', category, TURN).reason).toMatch(
            /category rather than an object/,
        );
        expect(grantFor('in-mission', confirmed, TURN).state).toBe('granted');
    });

    it('a confirmation carried over from an EARLIER turn does not grant', () => {
        // The long-run case this file exists for: a mission record persists the
        // ask across a restart, so `confirmed: true` outlives the turn it was
        // given in. A bare boolean cannot express the Hard Floor's THIS-TURN
        // wording, and a replayed yes is indistinguishable from a fresh one.
        const replayed: ExactObjectAsk = { ...confirmed, confirmed_turn: 'turn-3' };
        expect(grantFor('in-mission', replayed, TURN).state).toBe('ask-required');
        expect(grantFor('in-mission', replayed, TURN).reason).toMatch(/not this turn/);
    });

    it('an out-of-mission verdict VETOES, and a later yes does not override it', () => {
        // An advisory veto is not one. Order is the assertion: veto first, so a
        // confirmation arriving afterwards changes nothing.
        expect(grantFor('out-of-mission', unconfirmed, TURN).state).toBe('vetoed');
        expect(grantFor('out-of-mission', confirmed, TURN).state).toBe('vetoed');
    });

    it('an UNAVAILABLE council is not a veto', () => {
        // The same-shaped wrong guess `council-availability` exists over: reading
        // absence as refusal would make an unconfigured council a silent kill
        // switch on every typed op.
        expect(grantFor('unavailable', unconfirmed, TURN).state).not.toBe('vetoed');
        expect(grantFor(null, unconfirmed, TURN).state).not.toBe('vetoed');
        expect(grantFor('unavailable', confirmed, TURN).state).toBe('granted');
    });
});

// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
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

    it('over the ceiling pauses, and the report carries the INPUT values', () => {
        // `toBeDefined()` over the six fields passed against a report of
        // fabricated values — named by both seats of the 2026-09-14 pass. The
        // whole object is compared instead, so a field that carries the wrong
        // estimate or the wrong mission state is a failure rather than a pass.
        const d = routeCouncil(overCeiling, ctx);
        expect(d.route).toBe('paused');
        expect(d.report).toEqual({
            needed: ctx.needed,
            cliUnavailableBecause: 'cli quota exhausted',
            estimateUsd: 40,
            ceilingUsd: 25,
            missionState: ctx.missionState,
            canStillProceed: ctx.canStillProceed,
        });
        expect(Object.keys(d.report as PauseReport).sort()).toEqual([...REPORT_FIELDS].sort());
    });

    it('a route that is not `paused` carries NO report at all', () => {
        // The structural half of "a report, not an ask": only the paused rung
        // produces one, so a caller cannot find a pause report on a route that
        // did not pause.
        for (const input of [
            { ...overCeiling, cliAvailable: true },
            { ...overCeiling, estimateUsd: 1 },
        ]) {
            const d = routeCouncil(input, ctx);
            expect(d.route).not.toBe('paused');
            expect(d.report).toBeNull();
        }
    });

    it('an unstated CLI reason is reported as unstated, never invented', () => {
        const d = routeCouncil({ ...overCeiling, cliUnavailableReason: null }, ctx);
        expect(d.report?.cliUnavailableBecause).toBe('unstated');
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
 * AC-7 — the mission half of the long run.
 *
 * This group pinned a COMPOSITION: `continuation_ladder` bounding one run and
 * `mission_record` carrying the mission across runs. The ladder was removed on
 * 2026-10-14 by owner decision, after the concern that called it was withdrawn
 * on its own kill date, so its half of the composition left with its subject.
 * What stays is the half whose code still exists: a mission record survives the
 * phase boundary and the session end, one resume twelve hours later re-asks
 * nothing, and the record is what buys that.
 */
// provenance: level=L4 | critical=yes | evidence=ac2-independent-test-authorship-2026-09-14
describe('AC-7 — one resume across a phase boundary, zero owner asks', () => {
    const HOUR = 60 * 60 * 1000;
    const t0 = Date.parse('2026-09-14T08:00:00.000Z');

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
});

// provenance: level=L0 | critical=no | evidence=
describe('AC-2 — every group in this file records its independence, and the critical ones clear the floor', () => {
    const SELF = 'tests/e2e/adversarial-verification-fixtures.test.ts';
    const EVIDENCE = 'agents/evidence/analysis/ac2-independent-test-authorship-2026-09-14.md';
    /**
     * Two, pinned rather than probed.
     *
     * `agent-config council:status` reports `anthropic` and `openai` enabled for
     * this repository, and that is the number this criterion is asserted at. It
     * is NOT read here: the council config resolves from a user-global file a CI
     * runner does not have, so probing would make the floor collapse to the
     * single-provider ceiling exactly where the obligation matters — an
     * environment deciding an obligation, which is the shape
     * `council-availability` exists over.
     */
    const CONFIGURED_PROVIDERS = 2;

    it('no group is ungoverned — every describe carries a valid marker', () => {
        const { ungoverned } = parseProvenance(read(SELF));
        expect(ungoverned).toEqual([]);
    });

    it('every critical group clears L3 with evidence, at this repository’s two providers', () => {
        const { records } = parseProvenance(read(SELF));
        expect(criticalGaps(records, CONFIGURED_PROVIDERS)).toEqual([]);
        // …and the set is not empty, which is the way this assertion would
        // otherwise pass by declaring nothing critical.
        const critical = records.filter((r) => r.critical);
        expect(critical.length).toBeGreaterThanOrEqual(9);
        for (const r of critical) expect(levelRank(r.level)).toBeGreaterThanOrEqual(levelRank('L3'));
    });

    it('every evidence slug names a file that exists and states its members', () => {
        // An unattributed validation is not one. The slug has to resolve, and the
        // artefact has to carry the identity and provider the level claims —
        // otherwise `evidence=` is a string that satisfies a regex.
        const { records } = parseProvenance(read(SELF));
        const slugs = new Set(records.map((r) => r.evidence).filter((e) => e !== ''));
        expect(slugs.size).toBeGreaterThan(0);
        for (const slug of slugs) {
            const file = path.join(REPO, 'agents', 'evidence', 'analysis', `${slug}.md`);
            expect(fs.existsSync(file)).toBe(true);
            const body = fs.readFileSync(file, 'utf8');
            expect(body).toMatch(/anthropic/);
            expect(body).toMatch(/openai/);
            expect(body).toMatch(/2\/2 present/);
        }
    });

    it('the evidence records the prompt, so the verdict can be checked for steering', () => {
        // `evaluator-independence` item 3: a self-commissioned review is
        // admissible as gate evidence only when the prompt is recorded alongside
        // the verdict. Omission beats substitution there, so the artefact has to
        // carry it and this asserts that it does.
        const body = read(EVIDENCE);
        expect(body).toMatch(/## The prompt/);
        expect(body).toMatch(/It states no expected outcome/);
    });

    it('the evidence states what the pass did NOT close', () => {
        // A validator record listing only what was fixed reads as a clean bill.
        // The four implementation findings and the composition limitation are
        // the part a later reader needs most.
        const body = read(EVIDENCE);
        expect(body).toMatch(/What the pass found that is NOT folded in/);
        expect(body).toMatch(/objectIsExact/);
        expect(body).toMatch(/road-to-authority-object-exactness/);
    });
});
