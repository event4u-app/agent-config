// Tests for `src/rules/settings-ask-protocol.md` — Phase 5 of
// `road-to-zero-ceremony-settings`.
//
// WHAT THIS SUITE IS FOR, because a suite over rule prose can easily be
// theatre. Two of the checks below are grep-shaped and weak on purpose (they pin
// the Iron Law's load-bearing clauses so a rewrite cannot quietly drop them).
// The rest are the point: they derive the rule's key lists FROM
// `docs/contracts/settings-classes.md` and fail when the two disagree.
//
// That is the failure this protocol can actually suffer. The rule names nine
// keys in two classes; the classes live in a contract that a future PR will
// reclassify. A snapshot of today's nine would rot silently and the agent would
// then persist a key the writer refuses — the exact illegal write the class
// fence exists to stop. So the contract is the source here too, never a literal.
//
// The matcher is imported, never reimplemented: a hand-rolled `includes()` would
// measure this test's idea of routing instead of the router's.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { load as yamlLoad } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import {
    changeCommand,
    planSettingsAsks,
    silentDefaultsSummary,
} from '../../src/shared/settingsAsks.js';
import {
    consentGranted,
    consentVerdict,
    withheldReason,
} from '../../src/shared/settingsConsent.js';
import {
    buildSettingsClassIndex,
    isConservativeDefault,
    parseSettingsClassRows,
} from '../../src/shared/settingsClasses.js';
// The deletion half of the surface: a key removed from the contract must be
// recorded here, or an old install silently keeps a value nothing reads.
import { REMOVED_KEYS } from '../../src/scripts/_lib/agent_settings.js';

const REPO = path.resolve(__dirname, '..', '..');
const RULE = path.join(REPO, 'src', 'rules', 'settings-ask-protocol.md');
const CONTRACT = path.join(REPO, 'docs', 'contracts', 'settings-classes.md');

const ruleText = (): string => fs.readFileSync(RULE, 'utf8');
const contractText = (): string => fs.readFileSync(CONTRACT, 'utf8');

/**
 * The rule with runs of whitespace collapsed.
 *
 * Prose assertions use this, because where a sentence happens to wrap is not
 * what any of them are testing — and a `\s*\n?` sprinkled into every pattern
 * both hides that fact and breaks the moment a reflow moves the newline one word
 * over. Structural assertions (the Iron Law block, the tables) keep reading the
 * raw text, where the line breaks ARE the content.
 */
const flat = (): string => ruleText().replace(/\s+/g, ' ');

/** The rule's frontmatter, parsed — never regex-scraped. */
function frontmatter(): Record<string, unknown> {
    const m = /^---\n([\s\S]*?)\n---/.exec(ruleText());
    if (m === null) {
        throw new Error('settings-ask-protocol.md carries no frontmatter');
    }
    return yamlLoad(m[1] ?? '') as Record<string, unknown>;
}

/** Dotted keys of a given class, read out of the contract's own table. */
function keysOfClass(cls: 'A' | 'B' | 'C'): string[] {
    const index = buildSettingsClassIndex(parseSettingsClassRows(contractText()));
    return [...index.entries()].filter(([, c]) => c === cls).map(([k]) => k).sort();
}

/** The default cell of a contract row, as written. */
function declaredDefault(key: string): string | undefined {
    const re = new RegExp(`^\\|\\s*\`${key.replace(/\./g, '\\.')}\`\\s*\\|\\s*[ABC]\\s*\\|\\s*([^|]*?)\\s*\\|`, 'm');
    return re.exec(contractText())?.[1];
}

describe('settings-ask-protocol — the artefact exists and is routed', () => {
    it('ships as an auto rule with at least one trigger', () => {
        const fm = frontmatter();
        expect(fm['type']).toBe('auto');
        expect(fm['alwaysApply']).toBe(false);
        expect(Array.isArray(fm['triggers'])).toBe(true);
        expect((fm['triggers'] as unknown[]).length).toBeGreaterThan(0);
    });

    it('declares its enforcement honestly rather than borrowing a neighbour gate', () => {
        // The one-per-execution budget is model-carried. Claiming a hook here
        // would be the coverage inflation this repo's gate discipline refuses.
        //
        // The SPELLING moved on 2026-08-23 and the assertion follows it rather
        // than being relaxed: the bare `none` was retired for
        // `instruction-only: <reason>`, because "nothing enforces this" and
        // "nothing enforces this AND here is why that is the right call" are not
        // the same statement. So this now pins BOTH halves — the honest level,
        // and that a reason is actually present. A bare `instruction-only` with
        // no reason resolves to `missing` in check_enforcement_coverage and
        // fails the schema pattern, which is the property this line protects.
        const declared = frontmatter()['enforced_by'] as string[];
        expect(declared).toHaveLength(1);
        expect(declared[0]).toMatch(/^instruction-only: \S/);
        expect(ruleText()).toMatch(/`instruction-only`/);
    });

    it('keeps the description inside the auto-rule cap', () => {
        // 150, not the schema's 190 — check_augment_description_cap narrows it
        // for `type: auto` because each char costs a char of workspace budget.
        expect(String(frontmatter()['description']).length).toBeLessThanOrEqual(150);
    });
});

describe('the one-question budget — the Iron Law clauses that carry it', () => {
    it('states the per-execution ceiling', () => {
        expect(ruleText()).toMatch(/AT MOST ONE SETTINGS QUESTION PER COMMAND EXECUTION/);
    });

    it('names the conservative default as the fate of every further undecided key', () => {
        const text = ruleText();
        expect(text).toMatch(/FURTHER UNDECIDED KEYS TAKE THE CONSERVATIVE DEFAULT SILENTLY/);
        expect(text).toMatch(/NAMED\s*\n?IN THE END-SUMMARY/);
    });

    it('refuses a permissive silent default in as many words', () => {
        expect(ruleText()).toMatch(/A SILENT PERMISSIVE DEFAULT IS A DECISION TAKEN IN THE USER'S NAME/);
    });

    it('closes the batching loophole — one block is one question only if one number answers it', () => {
        // Without this clause the budget is trivially satisfied by merging three
        // questions into one options block, which is the same ask wearing a
        // different shape.
        expect(ruleText()).toMatch(/Batching them into a single numbered-options block is the same\s*\n?violation/);
    });

    it('points the end-summary at the one that already exists', () => {
        // `direct-answers` (kernel) owns "ONE end-summary"; a second one would
        // be a competing summary, which `communication-through-line` forbids.
        expect(ruleText()).toMatch(/end-summary/);
        expect(ruleText()).not.toMatch(/a separate summary|its own summary|second summary/i);
    });
});

describe('slot 4 — the destination is bound to the class, not to taste', () => {
    it('binds B to the persisting writer with the jit-answer provenance', () => {
        const text = ruleText();
        expect(text).toMatch(/settings:set <key> <value> --source jit-answer/);
        expect(text).toMatch(/you will not be asked again/);
    });

    it('binds C-set-to-ask to this run only, with no writer at all', () => {
        const text = ruleText();
        expect(flat()).toMatch(/not saved; making it permanent is a human edit/);
        // The load-bearing negation: the agent writes nothing for a C key.
        expect(text).toMatch(/CLASS C SET TO `ask` → THIS RUN ONLY\. THE AGENT NEVER PERSISTS IT\./);
    });

    it('declares slot 4 non-optional', () => {
        expect(ruleText()).toMatch(/it is not\s*\n?\s*optional/);
    });
});

describe('the key lists are DERIVED from the class contract, not snapshotted', () => {
    it('names every B key the contract declares, and no key that is not B', () => {
        const bKeys = keysOfClass('B');
        // Guard the guard: if B ever empties, the assertions below pass
        // vacuously and this suite would certify an empty protocol.
        expect(bKeys.length).toBeGreaterThan(0);
        const text = ruleText();
        for (const key of bKeys) {
            expect(text, `rule must name B key ${key}`).toContain(key);
        }
        // A key the rule calls B must actually be B. Catches the reverse drift:
        // the contract reclassifies a key to C and the rule keeps promising to
        // persist it.
        const bSection = /\*\*Class B — persist once\*\*[\s\S]*?\n\n/.exec(text)?.[0] ?? '';
        for (const named of bSection.match(/`([a-z_]+\.[a-z_]+)`/g) ?? []) {
            const key = named.replace(/`/g, '');
            expect(bKeys, `${key} is named as B but the contract disagrees`).toContain(key);
        }
    });

    it('states the B count the contract actually has', () => {
        expect(ruleText()).toContain(`**Class B — persist once**`);
        expect(ruleText()).toMatch(new RegExp(`\\*\\*B\\*\\* \\(${keysOfClass('B').length} keys\\)`));
    });

    it('every key the rule routes to the non-persisting path is class C', () => {
        const cKeys = new Set(keysOfClass('C'));
        const text = ruleText();
        // Terminate at the PARAGRAPH break, not at a sentence: the paragraph
        // after this one names `subagents.auto`, `subagents.budget_routing`
        // and `worktrees.mode`, all DELETED keys, and running past it would
        // assert three dead keys are class C — a failure with nothing to do
        // with the routing claim under test. Anchoring on prose was tried and
        // broke on a re-wrap; `\n\n` is the same anchor the Class-B check uses.
        const cSection = /Class C carrying an `ask` value[\s\S]*?\n\n/.exec(text)?.[0];
        expect(cSection, 'the C-ask section must be findable').toBeTruthy();
        const named = (cSection ?? '').match(/`([a-z_]+\.[a-z_]+)`/g) ?? [];
        expect(named.length).toBeGreaterThan(0);
        for (const raw of named) {
            const key = raw.replace(/`/g, '');
            expect(cKeys, `${key} is routed as C-ask but the contract does not class it C`).toContain(key);
        }
    });

    it('no C-ask key ships as ask, and the deleted one is gone from every surface', () => {
        // The rule distinguishes "ships as ask" from "can be set to ask". That
        // distinction is a claim about the template and must be checked, or it
        // becomes a comfortable fiction after the next default flip.
        //
        // ADR-229 deleted `worktrees.mode`, the last key that shipped as `ask`,
        // so the claim inverted: NONE of them ships that way. Both halves are
        // asserted — the survivors, and the absence of the deleted key. A
        // deletion checked only by "the rule no longer mentions it" would pass
        // with the key still live in the template.
        for (const key of ['tokens.rich_skills', 'subagents.adversarial_council', 'decision_engine.on_block']) {
            expect(declaredDefault(key), `${key} default cell`).not.toMatch(/ask/);
        }
        expect(declaredDefault('worktrees.mode'), 'gone from the class table').toBeUndefined();
        expect(keysOfClass('C'), 'gone from the C list').not.toContain('worktrees.mode');
        expect(REMOVED_KEYS.has('worktrees.mode'), 'recorded as a removed key').toBe(true);
    });

    it('every B key ships a conservative default, so absent never reads as yes', () => {
        // Half one of the contract's B invariant, re-asserted here because the
        // rule's promise ("absent is indistinguishable from no") depends on it.
        for (const key of keysOfClass('B')) {
            const cell = (declaredDefault(key) ?? '').replace(/`/g, '').trim();
            const value = cell === '""' || cell === "''" ? '' : cell === 'false' ? false : cell;
            expect(isConservativeDefault(value), `${key} default ${cell} must be conservative`).toBe(true);
        }
    });
});

describe('the nickname worked example — Phase 4 step 2', () => {
    it('names the prefill chain in order, including the Windows fallback', () => {
        const text = ruleText();
        expect(text).toMatch(/git config user\.name/);
        expect(text).toMatch(/\$USER/);
        expect(text).toMatch(/\$USERNAME/);
        // The recorded trap: `$USER` alone is wrong on Windows.
        expect(text).toMatch(/Never \$USER alone/);
    });

    it('writes the answer to the canary key through the sanctioned writer', () => {
        expect(ruleText()).toMatch(
            /settings:set personal\.canary_name "<name>" --source jit-answer/,
        );
    });

    it('tells the agent to check the already-armed layers before asking', () => {
        // The wizard writes identity.name into .agent-user.yml, which is the
        // canary's third layer — a wizard user is already covered and must not
        // be asked. Asking anyway is the cheap question this avoids.
        const text = ruleText();
        expect(text).toMatch(/identity\.name/);
        expect(flat()).toMatch(/third resolution layer/);
        expect(text).toMatch(/Check before asking/);
    });
});

// ---------------------------------------------------------------------------
// The budget as a computed split — Phase 5 exit criterion, verbatim:
// "a planted fixture needing three B decisions asks once, assumes two
// conservatively, and lists both in the summary".
//
// The fixture is built from the contract's REAL B keys, not from invented ones,
// so it is the criterion's own scenario and not a lookalike.
// ---------------------------------------------------------------------------

describe('planSettingsAsks — three B needs, one question', () => {
    const classes = () => buildSettingsClassIndex(parseSettingsClassRows(contractText()));
    /** The template defaults for the three B keys, per the contract's own cells. */
    const B_DEFAULTS: Record<string, unknown> = {
        'personal.canary_name': '',
        'personal.open_edited_files': false,
        'memory.learn_on_session_end': false,
    };
    const defaultOf = (k: string): unknown => B_DEFAULTS[k];

    it('the fixture is the real B set — three keys, all of them', () => {
        expect(keysOfClass('B')).toEqual(Object.keys(B_DEFAULTS).sort());
    });

    it('asks exactly once and defaults the other two', () => {
        const needed = ['personal.canary_name', 'personal.open_edited_files', 'memory.learn_on_session_end'];
        const plan = planSettingsAsks(needed, classes(), defaultOf);
        expect(plan.ask).toBe('personal.canary_name');
        expect(plan.silent.map((s) => s.key)).toEqual([
            'personal.open_edited_files',
            'memory.learn_on_session_end',
        ]);
        expect(plan.skipped).toEqual([]);
    });

    it('lists both defaulted keys in the summary, each with the command that changes it', () => {
        const plan = planSettingsAsks(
            ['personal.canary_name', 'personal.open_edited_files', 'memory.learn_on_session_end'],
            classes(),
            defaultOf,
        );
        const summary = silentDefaultsSummary(plan);
        expect(summary).toBeTruthy();
        expect(summary).toContain('personal.open_edited_files');
        expect(summary).toContain('memory.learn_on_session_end');
        expect(summary).toContain(changeCommand('personal.open_edited_files'));
        // The asked key must NOT appear — it was answered, not defaulted.
        expect(summary).not.toContain('personal.canary_name');
    });

    it('the question follows the caller\'s need order, not the alphabet', () => {
        const plan = planSettingsAsks(
            ['memory.learn_on_session_end', 'personal.canary_name'],
            classes(),
            defaultOf,
        );
        expect(plan.ask).toBe('memory.learn_on_session_end');
    });

    it('stamps the change command as manual, never as jit-answer', () => {
        // A silently defaulted key was not answered. Recording it as a
        // just-in-time answer would claim a consent nobody gave.
        expect(changeCommand('personal.open_edited_files')).toMatch(/--source manual$/);
        expect(changeCommand('personal.open_edited_files')).not.toMatch(/jit-answer/);
    });

    it('returns null for the summary when nothing was defaulted', () => {
        const plan = planSettingsAsks(['personal.canary_name'], classes(), defaultOf);
        expect(plan.silent).toEqual([]);
        expect(silentDefaultsSummary(plan)).toBeNull();
    });
});

describe('planSettingsAsks — what never reaches the ask path', () => {
    const classes = () => buildSettingsClassIndex(parseSettingsClassRows(contractText()));
    const defaultOf = (): unknown => false;

    it('skips a C key — its runtime ask is a different mechanism', () => {
        const plan = planSettingsAsks(['subagents.adversarial_council'], classes(), defaultOf);
        expect(plan.ask).toBeNull();
        expect(plan.skipped).toEqual([{ key: 'subagents.adversarial_council', reason: 'class-c-guarded' }]);
    });

    it('skips an A key — it resolves to its default and is never asked', () => {
        const anA = keysOfClass('A')[0];
        expect(anA).toBeTruthy();
        const plan = planSettingsAsks([anA as string], classes(), defaultOf);
        expect(plan.ask).toBeNull();
        expect(plan.skipped[0]?.reason).toBe('class-a-never-asked');
    });

    it('treats an unclassified key as guarded, never as free', () => {
        const plan = planSettingsAsks(['nonsense.not_a_real_key'], classes(), defaultOf);
        expect(plan.ask).toBeNull();
        expect(plan.skipped[0]?.reason).toBe('unclassified');
    });

    it('never re-asks a key that is already decided on any layer', () => {
        const plan = planSettingsAsks(
            ['personal.canary_name', 'personal.open_edited_files'],
            classes(),
            (k) => (k === 'personal.open_edited_files' ? false : ''),
            new Set(['personal.canary_name']),
        );
        expect(plan.ask).toBe('personal.open_edited_files');
        expect(plan.skipped).toEqual([{ key: 'personal.canary_name', reason: 'already-decided' }]);
    });

    it('a duplicate in the need list does not consume the budget twice', () => {
        const plan = planSettingsAsks(
            ['personal.canary_name', 'personal.canary_name', 'personal.open_edited_files'],
            classes(),
            (k) => (k === 'personal.open_edited_files' ? false : ''),
        );
        expect(plan.ask).toBe('personal.canary_name');
        expect(plan.silent.map((s) => s.key)).toEqual(['personal.open_edited_files']);
    });

    it('refuses to silently take a NON-conservative default', () => {
        // The Iron Law's last line. A permissive silent default is a decision
        // taken in the user's name, so it is surfaced rather than inherited.
        const plan = planSettingsAsks(
            ['personal.canary_name', 'personal.open_edited_files'],
            classes(),
            (k) => (k === 'personal.open_edited_files' ? true : ''),
        );
        expect(plan.ask).toBe('personal.canary_name');
        expect(plan.silent).toEqual([]);
        expect(plan.skipped).toEqual([
            { key: 'personal.open_edited_files', reason: 'non-conservative-default' },
        ]);
    });

    it('asks nothing at all when the execution needs nothing', () => {
        const plan = planSettingsAsks([], classes(), defaultOf);
        expect(plan).toEqual({ ask: null, silent: [], skipped: [] });
    });
});

// ---------------------------------------------------------------------------
// The consent verifier — Phase 5 step 4, and the answer to the roadmap's Risk 3
// ("the provenance stamp becomes decoration"). Before this the sidecar was
// written by settings:set and only DISPLAYED by the GUI; nothing decided on it.
// ---------------------------------------------------------------------------

describe('consentVerdict — a value is not a decision', () => {
    it('grants when a human answered the just-in-time question', () => {
        expect(consentVerdict({ cls: 'B', value: true, source: 'jit-answer' })).toBe('granted');
    });

    it('grants for the GUI and for a manual write', () => {
        expect(consentVerdict({ cls: 'B', value: true, source: 'gui' })).toBe('granted');
        expect(consentVerdict({ cls: 'B', value: true, source: 'manual' })).toBe('granted');
    });

    it('REFUSES an auto-detected permission — a machine inference is not a consent', () => {
        // The load-bearing row. Without it the agent could reach its own
        // permission by observing the world.
        expect(consentVerdict({ cls: 'B', value: true, source: 'auto-detected' })).toBe(
            'withheld-machine-inferred',
        );
    });

    it('REFUSES a permissive value that nothing records — fail closed', () => {
        expect(consentVerdict({ cls: 'B', value: true })).toBe('withheld-unrecorded');
    });

    it('withholds on the conservative default regardless of provenance', () => {
        expect(consentVerdict({ cls: 'B', value: false, source: 'jit-answer' })).toBe(
            'withheld-default',
        );
        expect(consentVerdict({ cls: 'B', value: '', source: 'gui' })).toBe('withheld-default');
    });

    it('grants a hand-edit, which the class contract guarantees carries no stamp', () => {
        // The contract says the user may edit anything in their own file. A check
        // that refused that path would be a bug wearing a fence.
        expect(consentVerdict({ cls: 'B', value: true, handEdited: true })).toBe('granted');
    });

    it('is not applicable to A, to C, or to an unclassified key', () => {
        for (const cls of ['A', 'C', undefined] as const) {
            expect(consentVerdict({ cls, value: true, source: 'jit-answer' })).toBe(
                'not-a-consent-key',
            );
        }
    });

    it('consentGranted is true for granted and false for every withheld verdict', () => {
        expect(consentGranted({ cls: 'B', value: true, source: 'gui' })).toBe(true);
        expect(consentGranted({ cls: 'B', value: true, source: 'auto-detected' })).toBe(false);
        expect(consentGranted({ cls: 'B', value: true })).toBe(false);
        expect(consentGranted({ cls: 'B', value: false, source: 'gui' })).toBe(false);
    });

    it('explains every refusal and stays silent on the allow path', () => {
        expect(withheldReason('granted', 'personal.open_edited_files')).toBeNull();
        for (const v of [
            'withheld-default',
            'withheld-unrecorded',
            'withheld-machine-inferred',
            'not-a-consent-key',
        ] as const) {
            const reason = withheldReason(v, 'personal.open_edited_files');
            expect(reason, v).toBeTruthy();
            expect(reason, v).toContain('personal.open_edited_files');
        }
    });

    it('the two B keys that gate behaviour are the ones this applies to', () => {
        // Derived, not asserted: canary_name gates nothing (it is a name), the
        // other two gate an action. If the contract adds a B key this row does
        // not break — it documents which of today's three the gate is for.
        const b = keysOfClass('B');
        expect(b).toContain('personal.open_edited_files');
        expect(b).toContain('memory.learn_on_session_end');
    });
});

describe('the migration — every ask-shaped setting routes to the protocol', () => {
    // Phase 5 step 3 (narrowed by road-to-always-on-orchestration Phase 1,
    // which deleted `subagents.auto` and `subagents.budget_routing` — the two
    // sites that used to own them, `delegation-policy.md` and
    // `subagent-routing.md`, no longer need to defer an ask-shaped setting
    // that does not exist any more). The migration was performed and pinned
    // by nothing: a rewrite of either of these two remaining files could
    // restore its bespoke ask prose and no gate would notice, which is how a
    // universalised pattern quietly re-fragments. The two absences at the end
    // are the load-bearing half — without them this suite would also pass if
    // someone "migrated" the two keys the rule deliberately routes elsewhere.

    /** The two sites the protocol owns, and the key each one carries. */
    const MIGRATED: ReadonlyArray<readonly [string, string]> = [
        ['src/rules/token-budget-discipline.md', 'tokens.rich_skills'],
        [
            'src/domains/engineering-base/review/changes/command.md',
            'subagents.adversarial_council',
        ],
    ];

    /** The two the rule routes AWAY, each with the reason it states. */
    const CARVED_OUT: ReadonlyArray<readonly [string, RegExp]> = [
        ['worktrees.mode', /permission gate/u],
        ['decision_engine.on_block', /TTY prompt/u],
    ];

    /**
     * Index of the last `## See also` heading, or `null` when the file has no
     * see-also section at all. Everything at or after it is the footer.
     *
     * `null` rather than `lines.length`, because the two cases need different
     * assertions and collapsing them is how this check silently weakens: with
     * no boundary, "in the body" degenerates to plain presence — exactly the
     * check the block rejects as insufficient. Both remaining MIGRATED files
     * carry a `## See also` section today, so the `null` branch is currently
     * unexercised by this corpus — kept for the file that had none
     * (`subagent-routing.md`, removed from MIGRATED when its ask-shaped
     * setting was deleted) and for whichever file next joins the list without
     * one.
     */
    function seeAlsoBoundary(lines: readonly string[]): number | null {
        let boundary: number | null = null;
        lines.forEach((l, i) => {
            if (/^#{1,6}\s+see also\s*$/iu.test(l.trim())) boundary = i;
        });
        return boundary;
    }

    for (const [rel, key] of MIGRATED) {
        it(`${rel} defers the ask shape to the protocol in its BODY for ${key}`, () => {
            const lines = fs.readFileSync(path.join(REPO, rel), 'utf8').split('\n');
            expect(lines.some((l) => l.includes(key)), `${rel} must still own ${key}`).toBe(
                true,
            );

            // Body, not footer — and this discriminator was arrived at by
            // mutation, not by taste. A bare `toContain('settings-ask-protocol')`
            // passes for a file that restores its full bespoke ask prose and
            // keeps a see-also link, which is the exact regression this block
            // claims to guard. Line-proximity to a key mention was tried first
            // and ALSO passes that mutation, because the see-also section names
            // the key itself. What a demoted citation cannot survive is being
            // required in the body.
            const boundary = seeAlsoBoundary(lines);
            const cited = lines
                .map((l, i) => (l.includes('settings-ask-protocol') ? i : -1))
                .filter((i) => i >= 0);
            expect(cited.length, `${rel} must cite settings-ask-protocol`).toBeGreaterThan(0);

            if (boundary === null) {
                // No footer to hide in, so presence IS body-presence. Recorded
                // explicitly so a future file that GROWS a see-also section
                // moves onto the strict branch instead of quietly staying on
                // the weak one.
                expect(
                    lines.some((l) => /^#{1,6}\s+see also/iu.test(l.trim())),
                    `${rel}: a see-also-like heading exists but did not match the exact ` +
                        `boundary pattern — tighten seeAlsoBoundary rather than degrading`,
                ).toBe(false);
            } else {
                expect(
                    cited.some((i) => i < boundary),
                    `${rel}: settings-ask-protocol appears only in the see-also footer — ` +
                        `a link is not a deferral, and the bespoke prose may have returned`,
                ).toBe(true);
            }
        });
    }

    it('states, per carved-out key, why it is NOT on the protocol', () => {
        const text = ruleText();
        for (const [key, reason] of CARVED_OUT) {
            expect(text, key).toContain(key);
            expect(text, `${key} needs its carve-out reason`).toMatch(reason);
        }
    });

    it('the carved-out keys still live outside the protocol, in their own homes', () => {
        // Pointed at the files a real migration would actually touch. Scanning
        // the four MIGRATED files for `worktrees.mode` instead would pass
        // vacuously — they have no reason to mention it either way, so the
        // assertion could never fail for the reason it gives.
        //
        // If a future PR routes one of these through the settings protocol, that
        // is a real decision, and it should break here rather than pass
        // silently, because the carve-out prose in the rule would then be stale.
        const HOMES: ReadonlyArray<readonly [string, string]> = [
            ['src/skills/using-git-worktrees/SKILL.md', 'worktrees.mode'],
            [
                'src/agent-src/templates/scripts/work_engine/hooks/builtin/decision_gate.ts',
                'on_block',
            ],
        ];
        for (const [rel, key] of HOMES) {
            const text = fs.readFileSync(path.join(REPO, rel), 'utf8');
            expect(text, `${rel} should still own ${key}`).toContain(key);
            expect(
                text,
                `${rel} now cites settings-ask-protocol — the carve-out in the rule is stale`,
            ).not.toContain('settings-ask-protocol');
        }
    });
});

describe('who picks the moment — the half no gate can check', () => {
    it('carries the anti-coercion clause the class contract states as prose', () => {
        const text = ruleText();
        expect(flat()).toMatch(/user's own request arriving at a point where the setting is genuinely/);
        expect(text).toMatch(/convenient lull/);
    });

    it('says the run completing without the setting means there is no question', () => {
        expect(flat()).toMatch(/If the run would complete without the setting/);
    });
});

// ── ADR-233: the `org-pack` provenance class ────────────────────────────
//
// Three properties, and the third is the one that matters: the reader
// understands a value the writer cannot produce. If those two vocabularies
// ever converge, an agent can stamp its own permission, which is exactly what
// excluding `auto-detected` was meant to prevent.

describe('consentVerdict — org-pack provenance (ADR-233)', () => {
    const IN_SCOPE = 'telemetry.remote.enabled';
    const OUT_OF_SCOPE = 'memory.learn_on_session_end';

    it('grants inside telemetry.remote.*, where an org administrator decided', () => {
        expect(consentVerdict({
            cls: 'B', key: IN_SCOPE, value: true, source: 'org-pack',
        })).toBe('granted');
    });

    it('withholds outside that namespace — the grant is scoped, not general', () => {
        expect(consentVerdict({
            cls: 'B', key: OUT_OF_SCOPE, value: true, source: 'org-pack',
        })).toBe('withheld-org-pack-out-of-scope');
    });

    it('withholds when no key is supplied, because unproven scope is not scope', () => {
        expect(consentVerdict({ cls: 'B', value: true, source: 'org-pack' }))
            .toBe('withheld-org-pack-out-of-scope');
    });

    it('does not grant a conservative value just because an org set it', () => {
        expect(consentVerdict({
            cls: 'B', key: IN_SCOPE, value: false, source: 'org-pack',
        })).toBe('withheld-default');
    });

    it('leaves auto-detected never-consent, verbatim (ADR-233 D4)', () => {
        expect(consentVerdict({
            cls: 'B', key: IN_SCOPE, value: true, source: 'auto-detected',
        })).toBe('withheld-machine-inferred');
    });

    it('explains the refusal without claiming the value was machine-inferred', () => {
        const reason = withheldReason('withheld-org-pack-out-of-scope', OUT_OF_SCOPE);
        expect(reason).toContain(OUT_OF_SCOPE);
        expect(reason).toContain('telemetry.remote.');
        expect(reason).not.toContain('auto-detected');
    });

    it('consentGranted mirrors the verdict on both sides of the scope line', () => {
        expect(consentGranted({ cls: 'B', key: IN_SCOPE, value: true, source: 'org-pack' }))
            .toBe(true);
        expect(consentGranted({ cls: 'B', key: OUT_OF_SCOPE, value: true, source: 'org-pack' }))
            .toBe(false);
    });

    it('the CLI writer cannot produce the value the reader accepts (ADR-233 D3)', () => {
        // The invariant, read off the source rather than restated: the reader's
        // union carries `org-pack` and the writer's allowlist does not. A future
        // edit that adds it to the writer fails here, which is the whole point —
        // an agent-writable `org-pack` is a self-granted permission.
        const readerSrc = fs.readFileSync(
            path.join(REPO, 'src/shared/settingsConsent.ts'), 'utf-8');
        const writerSrc = fs.readFileSync(
            path.join(REPO, 'src/scripts/_cli/cmd_settings_set.ts'), 'utf-8');

        expect(readerSrc).toMatch(/export type ConsentSource[^;]*'org-pack'/u);

        const writerList = writerSrc.match(
            /const PROVENANCE_SOURCES:[^=]*=\s*\[([^\]]*)\]/u)?.[1] ?? '';
        expect(writerList).not.toContain('org-pack');
        // And the writer's own union, so the two cannot drift apart either.
        const writerUnion = writerSrc.match(/export type ProvenanceSource\s*=([^;]*);/u)?.[1] ?? '';
        expect(writerUnion).not.toContain('org-pack');
    });
});

describe('consentVerdict — org-pack outranks the hand-edit branch (review finding 3)', () => {
    const OUT_OF_SCOPE = 'memory.learn_on_session_end';

    it('withholds an out-of-scope org-pack grant even when the file was hand-written', () => {
        // The defect this pins: `handEdited` returned `granted` BEFORE the
        // org-pack branch, and `handEdited` is documented as true for exactly
        // the project-local `.agent-settings.yml` an org pack must ship. So
        // the namespace scope held for no real deployment — the only shape
        // where it mattered was the one that bypassed it.
        expect(consentVerdict({
            cls: 'B', key: OUT_OF_SCOPE, value: true, source: 'org-pack', handEdited: true,
        })).toBe('withheld-org-pack-out-of-scope');
    });

    it('still grants in scope with the same hand-edited file', () => {
        expect(consentVerdict({
            cls: 'B', key: 'telemetry.remote.enabled', value: true, source: 'org-pack', handEdited: true,
        })).toBe('granted');
    });

    it('leaves the hand-edit grant intact for every other source', () => {
        // The reorder must not cost the path the class contract guarantees.
        expect(consentVerdict({ cls: 'B', value: true, handEdited: true })).toBe('granted');
        expect(consentVerdict({
            cls: 'B', key: OUT_OF_SCOPE, value: true, source: 'manual', handEdited: true,
        })).toBe('granted');
        expect(consentVerdict({
            cls: 'B', key: OUT_OF_SCOPE, value: true, source: 'auto-detected', handEdited: true,
        })).toBe('granted');
    });
});
