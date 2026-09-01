/**
 * `guarded-baseline` — the third machine-readable step state, and its evidence
 * contract (AI council 2026-08-31, 2/2 convergent: anthropic/claude-sonnet-4-5 +
 * openai/codex-default, option C).
 *
 * A roadmap step whose `verify:` asserts a property of a mechanism that DOES NOT
 * YET EXIST may not close `[x]` — that overstates the evidence. It keeps the
 * canonical unchecked box, carries an annotation, and carries a structured
 * evidence record next to it:
 *
 *     - [ ] <!-- roadmap-status: guarded-baseline -->
 *           **7.3** …step text…
 *           ```yaml
 *           guarded_baseline:
 *             category: future-mechanism
 *             scope: src/scripts/ai_council/**
 *             command: npx vitest run tests/scripts/x.test.ts
 *             red_proof: sabotage run 2026-08-31 — 2 failed
 *             sabotage_model: added a `--topology` flag to the option table
 *             recheck_when: src/scripts/ai_council/topology_selector.ts
 *             discharged_ac: the baseline is pinned and RED-proven
 *             pending_ac: the constraint under real topology selection
 *           ```
 *
 * BOTH SEATS MADE THE TOOLING A CONDITION OF THE VERDICT — "C is acceptable only
 * if its tooling lands atomically; otherwise use ordinary `[ ]` with structured
 * evidence" — so the annotation is worth nothing without the five semantics
 * below, and they live here rather than duplicated in the two consumers:
 *
 *   1. reported separately and NEVER counted as done — the canonical box stays
 *      `[ ]`, so `count_checkboxes` already excludes it; `reportGuardedBaselines`
 *      is the separate surface that makes the state visible rather than silent;
 *   2. `archive_completed_roadmaps` treats it as incomplete and refuses archival;
 *   3. a `recheck_when` trigger that now RESOLVES in the tree marks the evidence
 *      STALE — the guard was written against an absence that has since ended;
 *   4. only verification against the real mechanism permits `[x]`;
 *   5. a baseline that has not demonstrably gone RED is an ordinary open item —
 *      hence `red_proof` is mandatory and its absence REJECTS the annotation.
 *
 * The two legal categories are the council's own split. An `absence-assertion`
 * step asserts something directly observable today and MAY close `[x]` once
 * sabotage-verified; a `future-mechanism` step is what this state exists for. No
 * third value is accepted and absence is not defaulted: defaulting would silently
 * promote the strict case into the lax one, which is the overstatement the whole
 * verdict is against.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** The annotation itself. Tolerant of internal spacing, nothing else. */
export const GUARDED_BASELINE_RE = /<!--[ \t]*roadmap-status:[ \t]*guarded-baseline[ \t]*-->/;

/** The only two legal `category:` values — see the header on why absence is not a default. */
export const GUARDED_CATEGORIES: readonly string[] = ['future-mechanism', 'absence-assertion'];

/**
 * `- [<glyph>] …` at any indent, with `-` or `*`.
 *
 * Deliberately neither of the two checkbox patterns already in this directory:
 * the dashboard's `CHECKBOX_RE` is `g`-sticky and requires trailing whitespace,
 * and the sweep's `DEFERRED_STEP_RE` pins `[~]`. This one has to CAPTURE the
 * glyph an annotation sits on — including `[x]` — because refusing that case is
 * the whole point of the validator below.
 */
const ANY_CHECKBOX_RE = /^[ \t]*[-*][ \t]+\[([ xX~-])\]/;

/** A following step or any heading ends the annotated step's span. */
const SPAN_END_RE = /^[ \t]*[-*][ \t]+\[[ xX~-]\]|^#{1,6}[ \t]/;

const BLOCK_START_RE = /^[ \t]*guarded_baseline:[ \t]*$/;
const FIELD_RE = /^[ \t]*([a-z_]+):[ \t]*(.*)$/;
const FENCE_RE = /^[ \t]*(?:```|~~~)/;

/**
 * A record annotates a STEP, so it is only recognised on a list item.
 *
 * Measured, not defensive: without this the very roadmap that SPECIFIES this
 * state reddened its own dashboard, because its verdict paragraph names the
 * annotation in prose. Same discipline `parse_blockers` already applies with
 * `_stripFencedCode` — a documentation example of a shape is not an instance of
 * it — extended to the two prose forms that actually occur, an inline code span
 * and a fenced example.
 */
const LIST_ITEM_RE = /^[ \t]*[-*][ \t]+/;
const INLINE_CODE_RE = /`[^`]*`/g;

/** One annotated step, as both consumers need it. */
export interface GuardedBaselineItem {
    /** 1-based line of the annotated line, for the messages. */
    line: number;
    /** Step text, from the annotated line or its first continuation line. */
    label: string;
    /**
     * The checkbox glyph the annotation actually sits on, or `null` when the
     * annotation is not on a checkbox line at all. Both non-`' '` and `null` are
     * rejections — recorded rather than normalised, so the message can say which.
     */
    glyph: string | null;
    /** Did the span carry a `guarded_baseline:` block at all? */
    hasBlock: boolean;
    fields: Readonly<Record<string, string>>;
}

function _label(annotatedLine: string, lines: readonly string[], i: number): string {
    const own = annotatedLine
        .replace(ANY_CHECKBOX_RE, '')
        .replace(GUARDED_BASELINE_RE, '')
        .replace(/\*\*/g, '')
        .trim();
    if (own !== '') {
        return own;
    }
    // The council's mechanical form puts the step text on the NEXT line.
    for (let j = i + 1; j < lines.length; j++) {
        const next = (lines[j] as string).trim();
        if (next === '') {
            continue;
        }
        if (SPAN_END_RE.test(lines[j] as string)) {
            break;
        }
        return next.replace(/\*\*/g, '').trim();
    }
    return '(unlabelled)';
}

/** Every `guarded-baseline`-annotated step in one roadmap, with its evidence block. */
export function parseGuardedBaselines(text: string): GuardedBaselineItem[] {
    const lines = text.split('\n');
    const out: GuardedBaselineItem[] = [];
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] as string;
        if (FENCE_RE.test(raw)) {
            inFence = !inFence;
        }
        // Inside a fence it is an example; inside backticks it is prose; off a
        // list item it is not a step at all. See LIST_ITEM_RE for the measurement.
        if (inFence || !LIST_ITEM_RE.test(raw)) {
            continue;
        }
        if (!GUARDED_BASELINE_RE.test(raw.replace(INLINE_CODE_RE, ''))) {
            continue;
        }
        const box = ANY_CHECKBOX_RE.exec(raw);
        const fields: Record<string, string> = {};
        let hasBlock = false;
        for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j] as string;
            if (SPAN_END_RE.test(line)) {
                break; // the next step — this one's span is over
            }
            if (FENCE_RE.test(line)) {
                continue; // a ```yaml wrapper is optional, and not the data
            }
            if (!hasBlock) {
                hasBlock = BLOCK_START_RE.test(line);
                continue;
            }
            const f = FIELD_RE.exec(line);
            if (f) {
                fields[f[1] as string] = (f[2] as string).trim();
            }
        }
        out.push({
            line: i + 1,
            label: _label(raw, lines, i),
            glyph: box ? (box[1] as string) : null,
            hasBlock,
            fields,
        });
    }
    return out;
}

/**
 * Every reason this annotation is REJECTED. Empty means the record is well
 * formed — never that the acceptance criterion is discharged.
 */
export function guardedBaselineProblems(items: readonly GuardedBaselineItem[]): string[] {
    const problems: string[] = [];
    for (const it of items) {
        const at = `line ${it.line} (${it.label})`;
        if (it.glyph === null) {
            problems.push(
                `${at}: the guarded-baseline annotation is not on a checkbox step — ` +
                    'it is only legal on an unchecked `- [ ]` line',
            );
        } else if (it.glyph !== ' ') {
            problems.push(
                `${at}: the guarded-baseline annotation sits on \`[${it.glyph}]\` — ` +
                    'the canonical checkbox stays UNCHECKED; only verification against ' +
                    'the real mechanism permits `[x]`',
            );
        }
        if (!it.hasBlock) {
            problems.push(`${at}: carries no adjacent \`guarded_baseline:\` evidence block`);
        }
        if ((it.fields['red_proof'] ?? '') === '') {
            problems.push(
                `${at}: records no \`red_proof\` — a baseline that has not demonstrably ` +
                    'gone RED is an ordinary open item, not a guarded one',
            );
        }
        const category = it.fields['category'] ?? '';
        if (category === '') {
            problems.push(
                `${at}: records no \`category\` — one of ${GUARDED_CATEGORIES.join(', ')} ` +
                    'is required, and absence is not defaulted',
            );
        } else if (!GUARDED_CATEGORIES.includes(category)) {
            problems.push(
                `${at}: records category \`${category}\`, which is not one of ` +
                    GUARDED_CATEGORIES.join(', '),
            );
        }
    }
    return problems;
}

/**
 * Which records are STALE, i.e. whose `recheck_when` trigger now resolves in the
 * tree — the mechanism the baseline was written against has arrived, so the
 * evidence describes a world that no longer exists.
 *
 * HONEST SCOPE. Only a PATH trigger is machine-checkable: a token containing `/`
 * is resolved against the repo root and stale iff it exists. A bare symbol name
 * cannot be decided from a path, so a record carrying ONLY symbol tokens is
 * returned as `unverifiable` rather than silently reading as "not stale" — an
 * unchecked trigger that looks checked is the failure this whole state exists
 * to avoid.
 *
 * A record whose trigger carries AT LEAST ONE path token is decided by that
 * path and is NOT reported as unverifiable, even when a companion symbol token
 * sits beside it. Reporting it would be the mirror of the failure above: a
 * checked trigger that looks unchecked. Measured 2026-09-01 — three of the four
 * lines the dashboard printed as "not machine-checkable" carried a path token
 * and were therefore already decidable, which is noise that trains a reader to
 * skip the section where the one genuinely undecidable trigger also lives.
 */
export function guardedBaselineStaleness(
    items: readonly GuardedBaselineItem[],
    repo_root: string,
): { stale: string[]; unverifiable: string[] } {
    const stale: string[] = [];
    const unverifiable: string[] = [];
    for (const it of items) {
        const trigger = it.fields['recheck_when'] ?? '';
        if (trigger === '') {
            continue;
        }
        const tokens = trigger.split(/[\s,]+/).filter((t) => t !== '');
        const paths = tokens.filter((t) => t.includes('/'));
        for (const token of paths) {
            if (fs.existsSync(path.join(repo_root, token))) {
                stale.push(
                    `line ${it.line} (${it.label}): recheck_when \`${token}\` now exists — ` +
                        're-verify against the real mechanism',
                );
            }
        }
        if (paths.length > 0) {
            continue;
        }
        for (const token of tokens) {
            unverifiable.push(`line ${it.line} (${it.label}): recheck_when \`${token}\``);
        }
    }
    return { stale, unverifiable };
}

/** One roadmap, as the report needs it — structural, so `RoadmapStats` fits as-is. */
export interface GuardedBaselineHost {
    readonly rel: string;
    readonly path: string;
}

export interface GuardedBaselineReport {
    /** Dashboard section, appended to the rendered markdown. `''` when nothing is annotated. */
    section: string;
    /** Rejections across every roadmap — `--check` must fail on these. */
    problems: number;
}

/**
 * Report every guarded baseline in the estate: a dashboard section, and the
 * rejections + staleness on stderr. Side-effecting on purpose, and named for it
 * — the sibling `_warn_merge_gated` does the same, and it keeps the caller at
 * one line in a file that sits at its size cap.
 */
export function reportGuardedBaselines(
    roadmaps: readonly GuardedBaselineHost[],
    repo_root: string,
    write: (s: string) => void = (s) => process.stderr.write(s),
): GuardedBaselineReport {
    const rows: string[] = [];
    let problems = 0;
    for (const r of roadmaps) {
        let items: GuardedBaselineItem[];
        try {
            items = parseGuardedBaselines(fs.readFileSync(r.path, { encoding: 'utf-8' }));
        } catch {
            continue;
        }
        if (items.length === 0) {
            continue;
        }
        const bad = guardedBaselineProblems(items);
        const { stale, unverifiable } = guardedBaselineStaleness(items, repo_root);
        problems += bad.length;
        rows.push(
            `| [${r.rel}](roadmaps/${r.rel}) | ${items.length} | ${stale.length} | ${bad.length} |`,
        );
        write(
            `🛡️   ${r.rel}: ${items.length} guarded-baseline step(s) — RED-proven, ` +
                'NOT complete, and blocking archival:\n',
        );
        for (const it of items) {
            write(`      - ${it.label}  (category ${it.fields['category'] ?? '—'})\n`);
        }
        for (const p of bad) write(`      ❌ ${p}\n`);
        for (const s of stale) write(`      ⚠️  ${s}\n`);
        for (const u of unverifiable) write(`      ·  not machine-checkable: ${u}\n`);
    }
    if (rows.length === 0) {
        return { section: '', problems };
    }
    return {
        section:
            '\n## 🛡️ Guarded baselines — RED-proven, not complete\n\n' +
            'These steps carry `<!-- roadmap-status: guarded-baseline -->`: an ' +
            'executable guard exists and has been shown to go RED under a named ' +
            'sabotage, but the acceptance criterion names a mechanism that does not ' +
            'exist yet. They are **not** done, they are **not** counted as done, and ' +
            'they **block archival** until the real mechanism is verified (council ' +
            '2026-08-31, 2/2 convergent).\n\n' +
            '| Roadmap | Guarded | Stale | Rejected |\n|---|---:|---:|---:|\n' +
            rows.join('\n') +
            '\n',
        problems,
    };
}
