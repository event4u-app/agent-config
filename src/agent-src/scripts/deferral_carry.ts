/**
 * Auto-carry for the archival sweep: a finished roadmap whose only obstacle is
 * bare `[~]` steps hands them to a follow-up roadmap and then archives.
 *
 * WHY. The dashboard renders a roadmap with zero open steps as 100 %, deferred
 * steps included, while the sweep refused every bare `[~]` and waited for a
 * human to write the `carried-to` annotation by hand. Nobody did: measured
 * 2026-10-02, five roadmaps sat at 100 % in the active tree with fourteen
 * unannotated deferrals between them, and `/roadmap:process-full` — which ends
 * non-interactively — had no step that could resolve one. "Finished" and
 * "archived" had silently come apart.
 *
 * The disposition this module executes is the one `roadmap-progress-sync`
 * Iron Law 3 already routes to the council without the owner: carry the item
 * AND its blocker into a named follow-up created in the SAME change. It keeps
 * every criterion alive in the active estate, so it is the preserving branch of
 * the preservation test, never a drop. The owner decided on 2026-10-02 that the
 * sweep performs it automatically instead of waiting for a menu.
 *
 * What the carry does, so the archived parent and the live child agree:
 *
 *   - every bare `[~]` block is copied verbatim into the child as an OPEN `[ ]`
 *     step — open, not `[~]`, because a child at 100 % on arrival would be
 *     carried again by the next sweep, forever;
 *   - the parent's step gets `<!-- deferred-resolution: carried-to=<child> -->`,
 *     and the child gets `parent_roadmap: <parent>`, which is the pair
 *     `deferralProblems` and `lint_deferral_integrity` validate from both ends;
 *   - every OPEN blocker a carried step names via `blocked-by: <id>` moves with
 *     it: copied verbatim into the child's `## Blockers`, and closed in the
 *     parent with a status line naming where it went. The open-blocker count is
 *     unchanged, it only changes file.
 *
 * NOT automatic when a moved blocker waits on the OWNER (owner decision
 * 2026-10-02): the sweep then writes nothing and asks — archive with the steps
 * parked in `later/` (`--owner-decision later`), or work them step by step with
 * the first one on screen. The procedure lives in `roadmap-process-loop` § 6a.
 *
 * Refused, so nothing is written, when the parent would still not archive
 * afterwards: an open blocker no carried step names is a decision the parent
 * itself raised, and carrying around it would strand the child with steps that
 * have no reason to exist apart from the parent. A human-written annotation
 * that fails validation is also left alone — fixing someone's wrong carry is
 * not this module's call.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * `<!-- deferred-resolution: carried-to=<slug> -->` — the resolved-deferral
 * annotation. `merged-into=<slug>` is the second accepted form.
 */
export const DEFERRED_RESOLUTION_RE =
    /<!--\s*deferred-resolution:\s*(carried-to|merged-into)\s*=\s*([A-Za-z0-9._-]+)\s*-->/;

/** `- [~] …` — a deferred step, at any indent, with `-` or `*`. */
export const DEFERRED_STEP_RE = /^[ \t]*[-*][ \t]+\[~\][ \t]*(.*)$/;

/** Any other checkbox, or a heading — where a step's block ends. */
export const BLOCK_END_RE = /^[ \t]*[-*][ \t]+\[[ xX~-]\]|^#{1,6}[ \t]/;

const BLOCKED_BY_RE = /blocked-by:\s*([A-Za-z0-9._-]+)/g;
const BLOCKER_HEAD_RE = /^###[ \t]+blocker:[ \t]*(.+?)[ \t]*$/i;
const STATUS_LINE_RE = /^([ \t]*-[ \t]+\*\*Status:\*\*[ \t]*)(.*)$/;
const AC_HEADING_RE = /^##[ \t]+acceptance/i;
const OWNER_LINE_RE = /^[ \t]*-[ \t]+\*\*Owner:\*\*[ \t]*`?([A-Za-z]+)/;

/**
 * Blocker owners that are NOT the human owner. Everything else — `maintainer`,
 * `user`, `owner`, and any value this list does not name — is owner-dependent:
 * in doubt it is the owner's decision, so an unrecognised owner fails closed.
 */
const AGENT_SIDE_OWNERS: ReadonlySet<string> = new Set(['implementer', 'council', 'agent', 'ai']);

/**
 * What happens to deferrals whose blockers wait on the owner.
 *
 * `ask` (default): nothing is written; the sweep reports the decision instead —
 * archive with the steps parked in `later/`, or work them step by step.
 * `later`: the owner chose to archive; the carry lands in `later/`.
 */
export type OwnerDecision = 'ask' | 'later';

/** The lightweight cap `lint_roadmap_complexity` enforces, with margin. */
const LIGHTWEIGHT_LINE_BUDGET = 500;

const DISPOSITION_DIRS: readonly string[] = ['', 'later', 'archive', 'skipped'];

interface BareStep {
    /** Line index of the `[~]` line in the parent. */
    line: number;
    /** The step line plus its continuation block, dedented to the step. */
    block: string[];
    isAcceptance: boolean;
    blockerIds: string[];
}

interface BlockerSpan {
    id: string;
    start: number;
    end: number;
    open: boolean;
    ownerDependent: boolean;
}

export interface CarryPlan {
    destSlug: string;
    destRel: string;
    destText: string;
    sourceText: string;
    carried: number;
    movedBlockers: string[];
    /** Moved blockers only the owner can resolve. Non-empty ⇒ the owner decides. */
    ownerBlockers: string[];
    /** The first carried step, verbatim, for the step-by-step offer. */
    firstStep: string;
    /** True when the carry targets `later/` (owner chose to archive). */
    parked: boolean;
}

export type CarryOutcome = { plan: CarryPlan } | { refused: string };

function _bareSteps(lines: readonly string[]): BareStep[] {
    const out: BareStep[] = [];
    let inAcceptance = false;
    // No fence skipping, on purpose: `parseDeferredItems` does not skip fences
    // either, and a step this module did not see but the sweep's validation does
    // would be written, then refused.
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string;
        if (/^##[ \t]/.test(line)) inAcceptance = AC_HEADING_RE.test(line);
        const m = DEFERRED_STEP_RE.exec(line);
        if (m === null) continue;
        let end = i + 1;
        while (end < lines.length && !BLOCK_END_RE.test(lines[end] as string)) end++;
        const raw = lines.slice(i, end);
        if (DEFERRED_RESOLUTION_RE.test(raw.join('\n'))) continue;
        while (raw.length > 1 && (raw[raw.length - 1] as string).trim() === '') raw.pop();
        const indent = (/^[ \t]*/.exec(line) as RegExpExecArray)[0].length;
        const block = raw.map((l) => (l.slice(0, indent).trim() === '' ? l.slice(indent) : l));
        const ids = new Set<string>();
        for (const b of raw) for (const hit of b.matchAll(BLOCKED_BY_RE)) ids.add(hit[1] as string);
        out.push({ line: i, block, isAcceptance: inAcceptance, blockerIds: [...ids] });
    }
    return out;
}

function _blockerSpans(lines: readonly string[]): BlockerSpan[] {
    const start = lines.findIndex((l) => /^##[ \t]+Blockers[ \t]*$/i.test(l));
    if (start === -1) return [];
    let sectionEnd = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^##[ \t]+\S/.test(lines[i] as string)) {
            sectionEnd = i;
            break;
        }
    }
    const spans: BlockerSpan[] = [];
    for (let i = start + 1; i < sectionEnd; i++) {
        const m = BLOCKER_HEAD_RE.exec(lines[i] as string);
        if (m === null) continue;
        let end = i + 1;
        while (end < sectionEnd && !/^###?[ \t]/.test(lines[end] as string)) end++;
        const status = lines
            .slice(i, end)
            .map((l) => STATUS_LINE_RE.exec(l))
            .find((s) => s !== null);
        const value = (status?.[2] ?? 'open').trim().toLowerCase();
        const owner = lines
            .slice(i, end)
            .map((l) => OWNER_LINE_RE.exec(l))
            .find((o) => o !== null);
        spans.push({
            id: (m[1] as string).trim(),
            start: i,
            end,
            open: !/^resolved\b/.test(value),
            ownerDependent: !AGENT_SIDE_OWNERS.has((owner?.[1] ?? '').toLowerCase()),
        });
    }
    return spans;
}

function _plusDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** The first `<base>-carried[-N]` slug no roadmap directory already holds. */
export function nextCarrySlug(root: string, sourceSlug: string): string {
    const base = sourceSlug.replace(/-carried(-\d+)?$/, '');
    for (let n = 1; ; n++) {
        const slug = n === 1 ? `${base}-carried` : `${base}-carried-${n}`;
        const taken = DISPOSITION_DIRS.some((d) =>
            fs.existsSync(path.join(root, 'agents', 'roadmaps', d, `${slug}.md`)),
        );
        if (!taken) return slug;
    }
}

function _title(sourceText: string, sourceSlug: string): string {
    const h1 = /^#[ \t]+(.+?)[ \t]*$/m.exec(sourceText.replace(/^---\n[\s\S]*?\n---\n/, ''));
    return h1 !== null ? (h1[1] as string) : sourceSlug.replace(/-/g, ' ');
}

/**
 * Plan the carry for one roadmap. Pure apart from reading which slugs exist, so
 * the sweep can decide before it writes anything.
 *
 * @param openBlockerIds every OPEN blocker the parent carries, as `collect()`
 *   counts them — the source of truth for "would it archive afterwards".
 */
export function planCarry(
    root: string,
    rel: string,
    text: string,
    openBlockerIds: readonly string[],
    date: string,
    ownerDecision: OwnerDecision = 'ask',
): CarryOutcome {
    const sourceSlug = rel.replace(/\.md$/, '');
    const lines = text.split('\n');
    const steps = _bareSteps(lines);
    if (steps.length === 0) return { refused: 'no bare `[~]` step to carry' };

    const named = new Set(steps.flatMap((s) => s.blockerIds));
    const stranded = openBlockerIds.filter((id) => !named.has(id));
    if (stranded.length > 0) {
        return {
            refused:
                `open blocker(s) no deferred step names (${stranded.join(', ')}) — ` +
                'carrying around them would not let this roadmap archive',
        };
    }
    const moved = _blockerSpans(lines).filter((b) => b.open && named.has(b.id));
    const ownerBlockers = moved.filter((b) => b.ownerDependent).map((b) => b.id);
    const parked = ownerBlockers.length > 0 && ownerDecision === 'later';

    const destSlug = nextCarrySlug(root, sourceSlug);
    const annotation = `<!-- deferred-resolution: carried-to=${destSlug} -->`;

    const out = [...lines];
    for (const b of moved) {
        for (let i = b.start; i < b.end; i++) {
            const s = STATUS_LINE_RE.exec(out[i] as string);
            if (s === null) continue;
            out[i] =
                `${s[1] as string}resolved — carried, still open, to \`${destSlug}\` ` +
                `with the steps it blocks (was: ${(s[2] as string).trim()})`;
            break;
        }
    }
    for (const s of steps) out[s.line] = `${out[s.line] as string} ${annotation}`;

    const toOpen = (block: readonly string[]): string =>
        block.map((l, i) => (i === 0 ? l.replace(/\[~\]/, '[ ]') : l)).join('\n');
    const phaseSteps = steps.filter((s) => !s.isAcceptance).map((s) => toOpen(s.block));
    const acSteps = steps.filter((s) => s.isAcceptance).map((s) => toOpen(s.block));
    const phaseName = `Deferred steps carried from ${sourceSlug}`;
    const blockerText = moved.map((b) => lines.slice(b.start, b.end).join('\n').trimEnd());

    const body = [
        `# ${_title(text, sourceSlug)} — carried`,
        '',
        `> **Source:** carried by the archival sweep on ${date} from`,
        `> [\`${sourceSlug}\`](${parked ? '../' : ''}archive/${sourceSlug}.md), which closed every other step.`,
        '> Each step below was `[~]` there and is restated verbatim as open work, so',
        '> archiving the parent buried nothing. Blockers the steps name moved with them.',
        '',
        '## Goal',
        '',
        `Every step ${sourceSlug} deferred is either done here or explicitly disposed`,
        'of — a step that still cannot run is re-deferred with its reason, never',
        'left to read as finished.',
        '',
        `## Phase 1 — ${phaseName}`,
        '',
        phaseSteps.length > 0
            ? phaseSteps.join('\n')
            : '- [ ] **1.1 Close the carried acceptance criteria below.** The parent deferred\n' +
              '      only acceptance criteria; this step is done when each is checked or disposed of.\n' +
              '      verify: every criterion under `## Acceptance Criteria` is `[x]` or `[-]`',
        '',
        ...(blockerText.length > 0 ? ['## Blockers', '', blockerText.join('\n\n'), ''] : []),
        '## Risk Register',
        `<!-- risk-review: v1 | reviewed: ${date} | reviewer: archive-sweep/auto-carry -->`,
        '',
        '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
        '|------|------|-----------|-------------|------------|----------------|',
        '| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred ' +
            'once for elapsed time or a decision can sit here as long as it sat in the parent | ' +
            'It now counts as open work in the dashboard instead of as 100 %, and its blocker ' +
            `is listed where the estate gates count it | Phase 1 — ${phaseName} |`,
        '',
        '## Acceptance Criteria',
        '',
        acSteps.length > 0
            ? acSteps.join('\n')
            : `- [ ] AC-1 — No step carried from \`${sourceSlug}\` is still \`[ ]\` without a recorded disposition.`,
        '',
    ].join('\n');
    const complexity = body.split('\n').length > LIGHTWEIGHT_LINE_BUDGET ? 'structural' : 'lightweight';
    // Parked: `status: later` plus the three-part `entry_condition:` mapping
    // `lint_roadmap_later_disposition` requires, and the growth claim the
    // `later_roadmaps` count needs — a new file in `later/` is not a parking
    // move, so no allowance covers it otherwise.
    const ids = ownerBlockers.join(', ');
    const parkedKeys = parked
        ? 'entry_condition:\n' +
          `  what: the owner resolves blocker(s) ${ids}\n` +
          '  when: whenever the owner takes the next step\n' +
          '  who: owner\n' +
          // `lint_roadmap_later_disposition` rule C: a park with no review date
          // reads exactly like an abandonment.
          `review_by: ${_plusDays(date, 90)}\n` +
          `estate_growth_exempt: >-\n  Owner-chosen archive of ${sourceSlug}: its deferred steps wait on owner\n` +
          `  blocker(s) ${ids} and are parked here instead of left active. The parent\n` +
          '  is archived in the same change, so the active count drops by one.\n'
        : '';
    const destText =
        `---\ncomplexity: ${complexity}\nstatus: ${parked ? 'later' : 'ready'}\nexecution:\n  mode: phase-checkpoints\n` +
        `parent_roadmap: ${sourceSlug}\n${parkedKeys}---\n${body}`;
    const destRel = parked ? `agents/roadmaps/later/${destSlug}.md` : `agents/roadmaps/${destSlug}.md`;

    return {
        plan: {
            destSlug,
            destRel,
            destText,
            sourceText: out.join('\n'),
            carried: steps.length,
            movedBlockers: moved.map((b) => b.id),
            ownerBlockers,
            firstStep: (steps[0] as BareStep).block.join('\n'),
            parked,
        },
    };
}
