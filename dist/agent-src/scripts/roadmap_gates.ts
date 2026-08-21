#!/usr/bin/env tsx
/**
 * `agent-config gates` — the open decisions that need the user, as actions.
 *
 * The dashboard (`update_roadmap_progress`) already parses every `## Blockers`
 * entry and already counts them per roadmap. What it does not do is separate
 * the blockers the *user* must resolve from the ones the maintainer or an
 * external party owns: the count links into a per-roadmap breakdown, so
 * answering "what do I have to do" means opening every anchor and filtering
 * `Owner:` by hand across the whole file. The fields exist, are CI-enforced by
 * `lint_roadmap_blockers`, and never reach the user in a form they can act on.
 *
 * This command is that missing projection, and nothing more: same parser
 * (`parse_blockers` / `collect`, imported — never re-implemented), filtered by
 * owner, ordered by how much each blocker unblocks, rendered action-first.
 *
 * Deliberately NOT a gate: it exits 0 whether or not decisions are pending.
 * Blocking a pipeline on "the user has an open decision" would turn a
 * visibility aid into a second thing to fight.
 *
 * `--reply` is the same projection shaped for the END OF A CHAT REPLY rather
 * than a terminal pane, and it exists because the pull channel above is only
 * read by someone who already knows to ask. Transcript forensics over three
 * consumer sessions found five "what do I do now?" follow-ups, every one of
 * them next to a blocker the agent HAD reported — as a file reference, as a
 * bare option count, or as a choice of substitute work. What the same corpus
 * also shows is that a tool's output gets carried into the reply verbatim
 * (the dashboard's step count appears word-for-word inside eight option
 * blocks). So the fix is not to make the agent format better from memory; it
 * is to hand it the finished text. See ADR-222.
 *
 * Two properties carry the contract mechanically:
 *   - Nothing owned by the user open ⇒ EMPTY output. "No blocker → no block"
 *     stops being a judgement call, so the command is safe to call
 *     unconditionally at reply-close.
 *   - Exactly ONE blocker is rendered in full — the one that unblocks most.
 *     Every other one is a single trailing line. The user is never handed a
 *     flat list to weigh themselves.
 *
 * Labels are English like the rest of the CLI surface; the agent mirrors them
 * into the user's language when it lifts them into a reply, exactly as it does
 * for `Recommendation:` / `Empfehlung:`.
 *
 * Invocation (from project root):
 *   ./agent-config gates            # decisions owned by the user
 *   ./agent-config gates --all      # every open blocker, grouped by owner
 *   ./agent-config gates --json     # machine-readable
 *   ./agent-config gates --reply    # reply-close form; empty when none
 *   ./agent-config gates --pending  # staged actions awaiting confirmation
 *   ./agent-config gates --execute <id>             # echo what would run
 *   ./agent-config gates --execute <id> --confirm   # run it and record the evidence
 *
 * `--execute` is the only mode that writes anything, and it takes exactly one
 * blocker id. **Without `--confirm` it runs nothing** — it prints the command
 * the entry authored so the operator sees the exact string first. Everything
 * else here reads. See `gate_execute.ts` for what it refuses to do — no sweep,
 * no resolve on a failed command, no invented budget ledger, no Hard-Floor
 * command even with `--confirm`, and class 3 unchanged.
 *
 * `--pending` reads a different source — the staged-confirmation store, not the
 * roadmap tree — and stays out of `--reply` on purpose. ADR-222 fixes the
 * reply-close form at exactly ONE decision rendered in full; folding a second
 * source into it would silently change which decision "the one" is, and that
 * contract is not this step's to move.
 */

import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';

import {
    collect,
    blocker_needs_user as needsUser,
    blocker_class as blockerClass,
    type Blocker,
} from './update_roadmap_progress.js';
import { probeLater, type ResumeFinding } from './resume_probe.js';
import { execute } from './gate_execute.js';
import { listPending } from '../templates/scripts/work_engine/hooks/builtin/staged_confirmation_store.js';
import type { StagedAction } from '../templates/scripts/work_engine/hooks/builtin/staged_confirmation.js';

const _HERE = fileURLToPath(import.meta.url);

/** Hard wrap for the rendered body — keeps output readable in a narrow pane. */
const WIDTH = 78;

interface Entry {
    blocker: Blocker;
    roadmapRel: string;
    /** Open steps in the roadmap this blocker sits in — the "unblocks" weight. */
    openSteps: number;
}

/**
 * Rejoin wrapped continuation lines into one step each.
 *
 * `parse_blockers` returns `todo` as raw stripped lines, so a step that wraps
 * over three source lines arrives as three entries. A new step starts at an
 * ordered marker (`1.`, `2)`) or a bullet; everything else continues the one
 * before it.
 */
function regroupTodo(todo: readonly string[]): string[] {
    const steps: string[] = [];
    for (const line of todo) {
        const startsStep = /^(\d+[.)]|[-*+])\s/.test(line);
        if (startsStep || steps.length === 0) {
            steps.push(line);
        } else {
            steps[steps.length - 1] = `${steps[steps.length - 1] as string} ${line}`;
        }
    }
    return steps;
}

/** Wrap `text` to `width`, indenting every line after the first by `indent`. */
function wrap(text: string, width: number, indent: string): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [];
    }
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
        const candidate = cur === '' ? w : `${cur} ${w}`;
        if (candidate.length > width && cur !== '') {
            lines.push(cur);
            cur = w;
        } else {
            cur = candidate;
        }
    }
    if (cur !== '') {
        lines.push(cur);
    }
    return lines.map((l, i) => (i === 0 ? l : indent + l));
}

/**
 * Column width for the label gutter — sized to the longest label in use
 * (`If you do nothing:`, 18 chars) plus one separating space, so no value ever
 * runs flush against its own label.
 */
const LABEL_W = 19;

/** A labelled block: `  Label:  value`, wrapped and hanging-indented. */
function field(label: string, value: string): string[] {
    const pad = '  ' + label.padEnd(LABEL_W);
    const indent = ' '.repeat(pad.length);
    const lines = wrap(value, WIDTH - pad.length, indent);
    if (lines.length === 0) {
        return [];
    }
    return [pad + lines[0], ...lines.slice(1)];
}

function collectEntries(roadmapRoot: string): Entry[] {
    const entries: Entry[] = [];
    for (const r of collect(roadmapRoot)) {
        for (const b of r.open_blockers) {
            entries.push({ blocker: b, roadmapRel: r.rel, openSteps: r.open_ });
        }
    }
    // Most-unblocking first; ties broken deterministically so two runs on an
    // unchanged tree print byte-identical output.
    entries.sort(
        (a, b) =>
            b.openSteps - a.openSteps ||
            a.roadmapRel.localeCompare(b.roadmapRel) ||
            a.blocker.id.localeCompare(b.blocker.id),
    );
    return entries;
}

/**
 * The parser's legacy fallback synthesises one blocker per `> Blocked until …`
 * note under the fixed id `legacy`. That id is an implementation detail and
 * says nothing to a reader, and its text is a *condition* ("blocked until X"),
 * not an imperative — so both the heading and the field label are renamed for
 * this one parser-defined case rather than dressed up as a step list.
 */
function isLegacy(b: Blocker): boolean {
    return b.id === 'legacy';
}

function renderEntry(e: Entry, index: number): string[] {
    const head = `${index} · ${isLegacy(e.blocker) ? 'blocked-until note' : e.blocker.id}`;
    const tail =
        e.openSteps > 0 ? `unblocks: ${e.openSteps} step${e.openSteps !== 1 ? 's' : ''}` : '';
    const dashes = Math.max(3, WIDTH - head.length - tail.length - 6);
    const out: string[] = [
        '',
        `── ${head} ${'─'.repeat(dashes)} ${tail}`.trimEnd(),
        ...field('Roadmap:', e.roadmapRel),
        ...field('Blocks:', e.blocker.blocks),
    ];

    // What is actually being decided, when the entry says so.
    if (e.blocker.question) {
        out.push(...field('The question:', e.blocker.question));
    }

    // The recommendation leads, because it is the answer — everything below it
    // is how to carry the answer out. An entry that predates the field says so
    // rather than rendering a silent gap: the reader needs to know the analysis
    // is missing, not merely that a line is absent.
    out.push(
        ...field(
            'Recommendation:',
            e.blocker.recommendation ||
                '(none recorded — this entry predates the field; ask for one before deciding)',
        ),
    );

    const doLabel = isLegacy(e.blocker) ? 'Blocked until:' : 'Do this:';
    const steps = regroupTodo(e.blocker.todo);
    if (steps.length === 0) {
        out.push(
            ...field(
                doLabel,
                '(no steps recorded — the blocker entry in the roadmap needs a ' +
                    '**What to do:** list)',
            ),
        );
    } else {
        out.push(...field(doLabel, steps[0] as string));
        for (const s of steps.slice(1)) {
            // Steps 2..n have no label of their own — align them under the
            // first step's text, i.e. the same gutter `field()` produces.
            const indent = ' '.repeat(LABEL_W + 2);
            const lines = wrap(s, WIDTH - LABEL_W - 2, indent);
            out.push(...lines.map((l, i) => (i === 0 ? indent + l : l)));
        }
    }
    if (e.blocker.ifNothing) {
        out.push(...field('If you do nothing:', e.blocker.ifNothing));
    }
    out.push(...field('Done when:', e.blocker.resolvedWhen));
    return out;
}

/**
 * The FIRED section — parked roadmaps whose resume condition has come true.
 *
 * Rendered after the blockers because it is a different kind of item: a
 * blocker is a gate nobody has opened, this is a gate that opened with nobody
 * standing in front of it. A tree with no `later/` notes at all renders
 * nothing; a tree that has them but none fired still prints the coverage line
 * below, deliberately — see the next paragraph.
 *
 * The undecidable count is printed even when zero fired, and that is the
 * point: "no resume condition has fired" and "the probe could read 12 of 44
 * conditions" are different statements, and only the second one is honest
 * about its own coverage.
 */
function renderResumed(findings: readonly ResumeFinding[]): string[] {
    const fired = findings.filter((f) => f.verdict === 'fired');
    const undecidable = findings.filter((f) => f.verdict === 'undecidable').length;
    if (findings.length === 0) {
        return [];
    }
    const out: string[] = [];
    if (fired.length > 0) {
        out.push('');
        const head = `FIRED · ${fired.length} parked roadmap${fired.length !== 1 ? 's' : ''} can resume`;
        out.push(`── ${head} ${'─'.repeat(Math.max(3, WIDTH - head.length - 4))}`);
        for (const f of fired) {
            out.push(...field('Roadmap:', f.file));
            out.push(...field('Condition:', f.condition));
            out.push(...field('Fired because:', f.why));
        }
        out.push('');
        out.push('Resume one with: `git mv agents/roadmaps/later/<file> agents/roadmaps/`');
        out.push('then `agent-config roadmap:progress`.');
    }
    out.push('');
    out.push(
        `Resume-probe coverage: ${findings.length - undecidable} of ${findings.length} ` +
            `park note${findings.length !== 1 ? 's' : ''} carry a machine-decidable condition` +
            (undecidable > 0 ? ` · ${undecidable} undecidable` : ''),
    );
    return out;
}

function render(
    entries: readonly Entry[],
    all: boolean,
    resumed: readonly ResumeFinding[] = [],
): string {
    const mine = entries.filter((e) => needsUser(e.blocker.owner));
    const others = entries.filter((e) => !needsUser(e.blocker.owner));
    const shown = all ? entries : mine;
    const lines: string[] = [];

    if (mine.length === 0) {
        lines.push(
            others.length === 0
                ? 'No open blockers at all.'
                : `Nothing is waiting on you. ${others.length} open blocker` +
                      `${others.length !== 1 ? 's' : ''} sit with maintainer/external` +
                      `${all ? '' : ' — see --all'}.`,
        );
    } else {
        const head =
            `${mine.length} decision${mine.length !== 1 ? 's' : ''} need${mine.length === 1 ? 's' : ''} you`;
        const rest =
            others.length > 0
                ? ` · ${others.length} more with maintainer/external${all ? '' : ' (--all)'}`
                : '';
        lines.push(head + rest);
    }

    let n = 0;
    for (const e of shown) {
        n += 1;
        lines.push(...renderEntry(e, n));
    }
    if (shown.length > 0) {
        lines.push('');
        // Deciding is not the same as executing, and a list that only decides
        // leaves the second half with the person who has the least context.
        // Naming the guided path here is the cheapest place to close that gap:
        // it is on screen at exactly the moment the reader is looking at a
        // decision they did not write.
        lines.push('Not sure about one of these? Ask your agent:');
        lines.push('  "guide me through <id>"   — one decision, step by step');
        lines.push('');
    }
    lines.push(...renderResumed(resumed));
    return lines.join('\n') + '\n';
}

/**
 * Reply-close form: the one blocking decision in full, the rest as one line.
 *
 * Deliberately narrower than `render()`. `Status` and `Owner` are roadmap-file
 * metadata that a reader of a reply cannot act on, so they are dropped; what
 * survives is what the user has to DO and how they will know it is done. The
 * five-field shape stays where it is enforced — in the roadmap file — and does
 * not follow the blocker into prose it would only pad.
 *
 * Returns '' when nothing is owned by the user, so the caller can append the
 * result unconditionally and get silence when silence is correct.
 */
/**
 * Whether a recorded recommendation was drafted by the agent rather than decided
 * by the maintainer.
 *
 * Read from the field's own text, because that is where the claim has to live: a
 * drafted recommendation is written INTO the roadmap so every consumer
 * (`gates`, `--reply`, the sheet) sees the same string, and a marker held only
 * in the sheet would be invisible to the other two. The convention is a leading
 * `(agent-drafted …)` — matched loosely on purpose, since the parenthetical also
 * carries a date and a sentence of provenance.
 */
export function isAgentDrafted(recommendation: string): boolean {
    return /\(agent-drafted\b/i.test(recommendation);
}

/**
 * How a row names its decision.
 *
 * `legacy` is the parser's PLACEHOLDER id for a `> Blocked until …` note, not an
 * identifier anyone wrote — `renderEntry` already substitutes "blocked-until
 * note" for exactly that reason, and the sheet printing the raw placeholder made
 * the two views disagree about the same row.
 */
export function sheetLabel(b: Blocker): string {
    return isLegacy(b) ? 'blocked-until note' : `\`${b.id}\``;
}

/** First sentence of a passage, for the one-line `Default:` column. */
function firstSentence(text: string): string {
    const trimmed = text.trim();
    if (trimmed === '') {
        return '';
    }
    const m = /^(.+?[.!?])(\s|$)/.exec(trimmed.replace(/\s+/g, ' '));
    return m === null ? trimmed.replace(/\s+/g, ' ') : (m[1] as string);
}

/**
 * The one-line question a sheet row leads with.
 *
 * `Question:` is an optional field and only 5 of the 21 user-owned entries carry
 * one (measured 2026-08-18), so a sheet that printed it and nothing else would
 * be blank for three quarters of the estate. Falling back to the first step of
 * `What to do:` and then to `Blocks:` is deterministic and derived from the
 * blocker's own text — which is why the row LABELS which of the three it used
 * rather than presenting all three as the same kind of statement.
 */
export function sheetQuestion(b: Blocker): { text: string; source: 'question' | 'todo' | 'blocks' } {
    if (b.question.trim() !== '') {
        return { text: firstSentence(b.question), source: 'question' };
    }
    const steps = regroupTodo(b.todo);
    if (steps.length > 0 && (steps[0] as string).trim() !== '') {
        return { text: firstSentence(steps[0] as string), source: 'todo' };
    }
    return { text: firstSentence(b.blocks), source: 'blocks' };
}

/**
 * The consolidated decision sheet — every user-owned decision in ONE artefact.
 *
 * `road-to-estate-drawdown` Phase 0 exists because thirteen reading assignments
 * spread across thirteen files did not happen once. The sheet is the whole of
 * the human's contribution to that campaign, front-loaded: one document, sorted
 * by how much each answer unblocks, with a default per item so that
 * accept-all-defaults is a valid answer.
 *
 * This differs from `--all` in the two ways that matter for that job. `--all`
 * renders every blocker grouped by owner and is a terminal view; the sheet is
 * user-owned ONLY, and every row carries a `Default:` plus the PROVENANCE of
 * that default. Provenance is the load-bearing column: a sheet that presented an
 * agent-drafted default beside a maintainer-recorded one as the same thing would
 * invite accept-all over exactly the items nobody has examined.
 *
 * No population figure is quoted here on purpose. The first version cited
 * "14 of 21 record a `Recommendation:`, 7 do not" as the justification, and the
 * change that added this renderer then drafted six of those seven — so the
 * docstring was contradicted by the sheet committed beside it (R2 finding).
 * The split is rendered in the sheet's own header from the live tree, which is
 * the only place it cannot go stale.
 *
 * Deterministic by construction — the generator never invents a default. Where
 * none is recorded it says so and names what the reader must supply, so
 * regenerating the sheet cannot silently overwrite an answer with a guess.
 */
/**
 * The recorded answer to the consolidated decision sheet.
 *
 * The sheet is DERIVED, so an answer written into it is lost on the next run —
 * the file says so in its own header. But `road-to-estate-drawdown` blocker
 * `b-consolidated-decision-sheet` resolves only when "the sheet records which
 * option was used", and a derived file cannot carry that by being edited. So the
 * option lives in a NON-derived sibling and the sheet reads it, which keeps the
 * sheet deterministic and still lets it state the answer.
 *
 * Read, never written, and absent is a first-class answer: no marker means the
 * sheet renders exactly as before, so this is additive to every existing caller.
 */
interface SheetAnswer {
    option: string;
    answered: string;
    authority: string;
}

const SHEET_ANSWER_REL = path.join('agents', 'decisions', 'consolidated-decision-sheet-answer.md');

/**
 * One line, three fields, all required — a partial marker is treated as absent
 * rather than rendered half-filled, because a header that named an option with
 * no date or authority would be less honest than one that says nothing.
 */
const SHEET_ANSWER_RE =
    /<!--\s*sheet-answer:\s*(.+?)\s*\|\s*answered:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*authority:\s*(\S+)\s*-->/;

export function readSheetAnswer(repoRoot: string): SheetAnswer | null {
    const file = path.join(repoRoot, SHEET_ANSWER_REL);
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        return null;
    }
    const m = SHEET_ANSWER_RE.exec(text);
    if (m === null) {
        return null;
    }
    return {
        option: (m[1] as string).trim(),
        answered: (m[2] as string).trim(),
        authority: (m[3] as string).trim(),
    };
}

/** The header block naming the recorded answer, or nothing when none is recorded. */
function answerBanner(answer: SheetAnswer | null): string[] {
    if (answer === null) {
        return [];
    }
    return [
        '>',
        `> **ANSWERED ${answer.answered} — ${answer.option}.**`,
        `> Recorded in \`${SHEET_ANSWER_REL}\` (not derived);`,
        `> authority \`${answer.authority}\`.`,
        '> The rows below are the ones still OPEN: an answered',
        '> row stays here until the work its own entry names is done, so this is a work',
        '> queue and not a count of unanswered questions.',
    ];
}

function renderSheet(
    entries: readonly Entry[],
    now: Date,
    answer: SheetAnswer | null = null,
): string {
    const mine = entries.filter((e) => needsUser(e.blocker.owner));
    const stamp = now.toISOString().slice(0, 10);
    if (mine.length === 0) {
        const banner = answerBanner(answer);
        return (
            `# Consolidated decision sheet — nothing owned by you (${stamp})\n\n` +
            'No open blocker in the active roadmap tree carries `Owner: user`. Nothing to answer.\n' +
            (banner.length === 0 ? '' : '\n' + banner.slice(1).join('\n') + '\n')
        );
    }

    const noRec = mine.filter((e) => e.blocker.recommendation.trim() === '');
    const legacyNotes = noRec.filter((e) => isLegacy(e.blocker)).length;
    const missing = noRec.length - legacyNotes;
    const drafted = mine.filter((e) => isAgentDrafted(e.blocker.recommendation)).length;
    const maintainerRecorded = mine.length - noRec.length - drafted;
    const out: string[] = [
        `# Consolidated decision sheet — ${String(mine.length)} decisions owned by you`,
        '',
        `> Generated ${stamp} by \`agent-config gates --sheet\` over \`agents/roadmaps/\`.`,
        '> Sorted by unblock count, descending. **Accept-all-defaults is a valid answer**',
        '> (`road-to-estate-drawdown` blocker `b-consolidated-decision-sheet`, option (a));',
        '> answering only the two largest-unblock items and deferring the rest is option (c),',
        '> which the roadmap itself recommends. Whichever you pick, the agent writes the answers',
        '> back into each roadmap at its own blocker — that is not your work.',
        '>',
        `> **Provenance of the ${String(mine.length)} defaults: ${String(maintainerRecorded)} maintainer-recorded ·`,
        `> ${String(drafted)} \`agent-drafted\` · ${String(missing)} with no recommendation at all ·`,
        `> ${String(legacyNotes)} legacy \`> Blocked until …\` note(s) that have no field to carry one.**`,
        '> The distinction is in every row on purpose: an agent-drafted default is the',
        '> least-examined thing on this sheet, and accept-all-defaults would accept those too.',
        '>',
        '> This file is DERIVED — every line above and below comes from the roadmaps themselves,',
        '> so regenerating is deterministic and an answer written into this file would be lost.',
        '> Answers go back into each roadmap at its own blocker; the agent does that.',
        ...answerBanner(answer),
        '',
        '| # | Decision | Roadmap | Unblocks | Default source |',
        '|---:|---|---|---:|---|',
    ];
    mine.forEach((e, i) => {
        const source =
            e.blocker.recommendation.trim() !== ''
                ? isAgentDrafted(e.blocker.recommendation)
                    ? '`agent-drafted`'
                    : 'maintainer-recorded'
                : isLegacy(e.blocker)
                  ? 'none — legacy note'
                  : 'none recorded';
        out.push(
            `| ${String(i + 1)} | ${sheetLabel(e.blocker)} | ${e.roadmapRel} | ` +
                `${String(e.openSteps)} | ${source} |`,
        );
    });

    mine.forEach((e, i) => {
        const q = sheetQuestion(e.blocker);
        const qLabel =
            q.source === 'question'
                ? 'recorded `Question:`'
                : q.source === 'todo'
                  ? 'derived from the first `What to do:` step'
                  : 'derived from `Blocks:`';
        const recorded = e.blocker.recommendation.trim();
        out.push(
            '',
            `## ${String(i + 1)} · ${sheetLabel(e.blocker)}`,
            '',
            `- **Roadmap:** ${e.roadmapRel}`,
            `- **Unblocks:** ${String(e.openSteps)} open step(s) — ${e.blocker.blocks || '(not recorded)'}`,
            `- **Question** (${qLabel})**:** ${q.text || '(the blocker records no question, no steps and no Blocks: field)'}`,
        );
        if (recorded === '' && isLegacy(e.blocker)) {
            // A legacy `> Blocked until …` note is not a `### blocker:` entry and
            // has no field to carry a recommendation. Saying "agent-drafted, to
            // be written in" would point at a slot that does not exist, so the
            // row names the actual next action instead.
            out.push(
                '- **Default:** _this is a legacy `> Blocked until …` note, not a `### blocker:` entry,' +
                    ' so it has no `Recommendation:` field to read. Converting it into a real blocker' +
                    ' entry is what gives it a default._',
                '- **Default source:** none — legacy note',
            );
        } else if (recorded === '') {
            out.push(
                '- **Default:** _none recorded — needs an agent-drafted default before this row can be' +
                    ' answered by accepting it._',
                '- **Default source:** `agent-drafted` (to be written in below, and marked as such)',
            );
        } else {
            const drafted = isAgentDrafted(recorded);
            out.push(
                `- **Default:** ${firstSentence(recorded)}`,
                drafted
                    ? '- **Default source:** `agent-drafted` — written into the roadmap’s ' +
                      '`Recommendation:` field and marked there, NOT a maintainer decision'
                    : '- **Default source:** maintainer-recorded `Recommendation:` in the roadmap',
                `- **Recommendation (full):** ${recorded.replace(/\s+/g, ' ')}`,
            );
        }
        if (e.blocker.ifNothing.trim() !== '') {
            out.push(`- **If you do nothing:** ${e.blocker.ifNothing.replace(/\s+/g, ' ')}`);
        }
        out.push(
            `- **Done when:** ${e.blocker.resolvedWhen.replace(/\s+/g, ' ') || '(not recorded)'}`,
            '- **Your answer:** _(accept default · override · defer)_',
        );
    });
    out.push('');
    return out.join('\n');
}

function renderReply(entries: readonly Entry[]): string {
    const mine = entries.filter((e) => needsUser(e.blocker.owner));
    if (mine.length === 0) {
        return '';
    }

    // `collectEntries` already sorted by unblocking weight, so the first entry
    // IS the one that matters most. Picking it here rather than asking the
    // caller to choose is the point: a flat list is the failure mode.
    const lead = mine[0] as Entry;
    const rest = mine.slice(1);
    const lines: string[] = [];

    lines.push(`Blocked: ${lead.blocker.blocks} — ${lead.roadmapRel}`);

    const steps = regroupTodo(lead.blocker.todo);
    const doLabel = isLegacy(lead.blocker) ? 'Blocked until:' : 'Do:';
    if (steps.length === 0) {
        lines.push(
            `${doLabel} (no steps recorded — the blocker entry needs a **What to do:** list)`,
        );
    } else if (steps.length === 1) {
        lines.push(...wrap(`${doLabel} ${steps[0] as string}`, WIDTH, '    '));
    } else {
        // Emitted as authored, never re-numbered: real blocker entries already
        // carry their own `1.` / `2.` markers (the CI-enforced `What to do:`
        // shape), so adding our own would produce "1. 1. …". An entry that
        // arrives unnumbered stays unnumbered — that is a fact about the
        // roadmap entry, and papering over it here would hide it from the
        // person who could fix it.
        lines.push(`${doLabel}`);
        for (const s of steps) {
            lines.push(...wrap(`  ${s}`, WIDTH, '     '));
        }
    }
    lines.push(...wrap(`Done when: ${lead.blocker.resolvedWhen}`, WIDTH, '    '));

    if (rest.length > 0) {
        // A count, not a roster. Naming all of them reproduces the exact
        // failure this form exists to end — "zwölf Entscheidungen bei Dir …
        // rund 850 Zeilen", which the transcript shows produced no decision at
        // all. The one that blocks is written out above; the rest are one
        // command away, and saying so is shorter than listing them and more
        // honest than hiding them.
        lines.push('');
        lines.push(
            ...wrap(
                `${rest.length} other decision${rest.length !== 1 ? 's' : ''} also wait${rest.length === 1 ? 's' : ''} on you, ` +
                    'none blocking this — `agent-config gates`.',
                WIDTH,
                '    ',
            ),
        );
    }

    return lines.join('\n') + '\n';
}

function renderJson(
    entries: readonly Entry[],
    all: boolean,
    resumed: readonly ResumeFinding[] = [],
): string {
    const pick = all ? entries : entries.filter((e) => needsUser(e.blocker.owner));
    return (
        JSON.stringify(
            {
                needsYou: entries.filter((e) => needsUser(e.blocker.owner)).length,
                other: entries.filter((e) => !needsUser(e.blocker.owner)).length,
                resumeFired: resumed.filter((f) => f.verdict === 'fired').length,
                resumeUndecidable: resumed.filter((f) => f.verdict === 'undecidable').length,
                resumed: resumed.filter((f) => f.verdict === 'fired'),
                blockers: pick.map((e) => ({
                    id: e.blocker.id,
                    roadmap: e.roadmapRel,
                    owner: e.blocker.owner,
                    needsYou: needsUser(e.blocker.owner),
                    // Resolved through the same absent-field default every
                    // other consumer applies, so a synthesised `legacy` note
                    // reads as class 3 rather than as a hole. `class` ships and
                    // the sibling `run` does not, and the asymmetry is the
                    // roadmap's, not a preference: `road-to-gate-autonomy` step
                    // 1.3 names this field as its acceptance condition, while
                    // nothing asks for the command here — `--execute` reads it
                    // off the entry via `locate()`. Emitting `run` would also
                    // need a call on the authored-vs-`commandOf()`-stripped
                    // form, which no consumer exists to settle.
                    class: blockerClass(e.blocker),
                    blocks: e.blocker.blocks,
                    unblocksSteps: e.openSteps,
                    todo: regroupTodo(e.blocker.todo),
                    resolvedWhen: e.blocker.resolvedWhen,
                })),
            },
            null,
            2,
        ) + '\n'
    );
}

/**
 * `--pending`: staged actions awaiting a human confirmation.
 *
 * A second source under the same verb, and the reason it belongs here rather
 * than in a new command is the verb's own definition — "open decisions that
 * need you, as actions". A staged irreversible action IS one, and the most
 * literal kind: the roadmap blockers above are decisions a human owes a plan,
 * this is a decision a human owes an action that is already loaded and waiting.
 *
 * Expired stages are counted, never listed as actionable. An expired stage
 * cannot execute (`stageStatus` derives that from the clock, not from a sweep
 * having run), so rendering it beside a live one would put two rows in front of
 * the reader where only one is a decision.
 */
function renderPending(root: string, now: number): string {
    const rows = listPending(root, now);
    const live = rows.filter((r) => r.status === 'pending');
    const expired = rows.filter((r) => r.status === 'expired');
    const lines: string[] = [];

    if (live.length === 0) {
        lines.push(
            expired.length === 0
                ? 'No staged actions awaiting confirmation.'
                : `Nothing awaits your confirmation. ${expired.length} stage` +
                      `${expired.length !== 1 ? 's' : ''} expired unconfirmed — the action never fired.`,
        );
        return lines.join('\n') + '\n';
    }

    lines.push(
        `${live.length} staged action${live.length !== 1 ? 's' : ''} await` +
            `${live.length === 1 ? 's' : ''} your confirmation` +
            (expired.length > 0 ? ` · ${expired.length} expired unconfirmed` : ''),
    );
    let n = 0;
    for (const { stage } of live) {
        n += 1;
        lines.push(...renderStage(stage, n));
    }
    lines.push('');
    return lines.join('\n') + '\n';
}

function renderStage(stage: StagedAction, index: number): string[] {
    const head = `${index} · ${stage.action}`;
    const tail = `token: ${stage.token}`;
    const dashes = Math.max(3, WIDTH - head.length - tail.length - 6);
    return [
        '',
        `── ${head} ${'─'.repeat(dashes)} ${tail}`.trimEnd(),
        // The object is the first field on purpose: an approval that does not
        // name the exact object is the thing non-destructive-by-default forbids,
        // so it is what the reader must see before anything else.
        ...field('Object:', stage.object),
        ...field('Staged by:', stage.source),
        ...field('Expires:', stage.expires_at),
    ];
}

function renderPendingJson(root: string, now: number): string {
    const rows = listPending(root, now);
    return (
        JSON.stringify(
            {
                awaitingYou: rows.filter((r) => r.status === 'pending').length,
                expired: rows.filter((r) => r.status === 'expired').length,
                staged: rows.map(({ stage, status }) => ({
                    token: stage.token,
                    action: stage.action,
                    object: stage.object,
                    source: stage.source,
                    stagedAt: stage.staged_at,
                    expiresAt: stage.expires_at,
                    status,
                })),
            },
            null,
            2,
        ) + '\n'
    );
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Same repo-root resolution as the dashboard: honour the cwd when it holds
 * `agents/roadmaps`, otherwise fall back to the git toplevel (monorepo
 * sub-project support).
 */
function _resolveRepoRoot(start: string, marker = path.join('agents', 'roadmaps')): string {
    if (_isDir(path.join(start, marker))) {
        return start;
    }
    try {
        const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
            cwd: start,
            encoding: 'utf-8',
            timeout: 10_000,
        });
        const top = (r.stdout || '').trim();
        if (r.status === 0 && top !== '' && _isDir(path.join(top, marker))) {
            return top;
        }
    } catch {
        /* not a git repo / git missing — keep the cwd default */
    }
    return start;
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const all = args.includes('--all');
    const json = args.includes('--json');
    const reply = args.includes('--reply');
    const pending = args.includes('--pending');
    const sheet = args.includes('--sheet');

    // `--execute <id>` is answered FIRST, and it is the only mode that writes.
    // It used to sit after the `--pending` early return, so `--pending
    // --execute <id>` silently did nothing; and it ignored `--json`, so a
    // JSON-requesting caller got prose. Both combinations now refuse loudly.
    const execIdx = args.indexOf('--execute');
    if (execIdx !== -1) {
        const id = args[execIdx + 1];
        if (id === undefined || id.startsWith('--')) {
            process.stderr.write(
                'usage: gates --execute <blocker-id> [--confirm]\n' +
                    '  Without --confirm the command is echoed and nothing runs.\n',
            );
            return 1;
        }
        if (pending) {
            process.stderr.write('gates: --execute and --pending are different sources; pick one.\n');
            return 1;
        }
        if (json) {
            process.stderr.write('gates --execute has no JSON form; its output is a report.\n');
            return 1;
        }
        const root = _resolveRepoRoot(process.cwd());
        const dir = path.join(root, 'agents', 'roadmaps');
        if (!_isDir(dir)) {
            process.stderr.write('No roadmaps directory — nothing to execute.\n');
            return 1;
        }
        const r = execute(dir, id, new Date(), { confirm: args.includes('--confirm') });
        process.stdout.write(r.report);
        return r.code;
    }

    // `--pending` resolves against `agents/runtime/`, not `agents/roadmaps/`,
    // and is answered BEFORE the roadmaps-directory exit below: a staged action
    // is independent of whether this project plans in roadmaps at all, so
    // "no roadmaps here" is not an answer to "what awaits my confirmation".
    if (pending) {
        const root = _resolveRepoRoot(process.cwd(), path.join('agents', 'runtime'));
        const now = Date.now();
        process.stdout.write(json ? renderPendingJson(root, now) : renderPending(root, now));
        return 0;
    }

    const repoRoot = _resolveRepoRoot(process.cwd());
    const roadmapRoot = path.join(repoRoot, 'agents', 'roadmaps');
    if (!_isDir(roadmapRoot)) {
        // `--reply` stays silent here too: a project without roadmaps has no
        // blocker to hand over, and a reply-close line saying so would be the
        // ceremony the form exists to avoid.
        process.stdout.write(
            reply
                ? ''
                : json
                  ? // Every key `renderJson` emits, so a consumer reading the
                    // resume fields gets 0 rather than `undefined` on the
                    // branch where there is no roadmap tree to probe.
                    JSON.stringify(
                          {
                              needsYou: 0,
                              other: 0,
                              resumeFired: 0,
                              resumeUndecidable: 0,
                              resumed: [],
                              blockers: [],
                          },
                          null,
                          2,
                      ) + '\n'
                  : 'No roadmaps directory — nothing to report.\n',
        );
        return 0;
    }

    const entries = collectEntries(roadmapRoot);
    // `--reply` deliberately does not carry the probe: ADR-222 fixes that form
    // at exactly ONE decision rendered in full, and a fired resume condition is
    // not a decision the reader owes anybody — it is a file that can move.
    // `--reply` and `--sheet` deliberately do not carry the probe: ADR-222 fixes
    // the reply form at exactly ONE decision rendered in full, and a fired resume
    // condition is not a decision the reader owes anybody — it is a file that can
    // move. The sheet is the same argument for the same reason: it is the set of
    // answers the user owes, and a movable file is not one of them.
    const resumed = reply || sheet ? [] : probeLater(roadmapRoot, repoRoot);
    process.stdout.write(
        sheet
            ? renderSheet(entries, new Date(), readSheetAnswer(repoRoot))
            : reply
              ? renderReply(entries)
              : json
                ? renderJson(entries, all, resumed)
                : render(entries, all, resumed),
    );
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvPath = path.resolve(process.argv[1]);
    if (import.meta.url === pathToFileURL(argvPath).href) {
        return true;
    }
    // A symlinked invocation (`.augment/scripts` → `dist/agent-src/scripts`, or
    // macOS /var → /private/var) makes the raw URLs differ: import.meta.url is
    // the resolved real path while argv[1] keeps the symlink. Compare realpaths
    // so the entry guard still fires through the projection.
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(argvPath);
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}

export {
    main,
    needsUser,
    regroupTodo,
    wrap,
    collectEntries,
    render,
    renderJson,
    renderReply,
    renderResumed,
    renderSheet,
    renderPending,
    renderPendingJson,
};
export type { Entry };
