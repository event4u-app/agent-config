/**
 * Resume-condition probe — a gate that opened with nobody standing in front
 * of it is the third failure shape `road-to-gate-autonomy` § 0 names.
 *
 * Every roadmap parked under `agents/roadmaps/later/` records a resume
 * condition; `lint_roadmap_later_disposition` enforces that one is **written**
 * and never asks whether it has since come true. Measured 2026-08-17:
 * `later/road-to-request-scoped-rule-load.md` waits on "P2.1 of
 * `road-to-rule-delivery-integrity` closes", and that whole roadmap archived —
 * the condition fired, the file stayed parked, and nothing in the tree could
 * have said so.
 *
 * This is a **class-0 gate** by the § 2 taxonomy: deterministic, free,
 * reversible, and its output IS the unblock signal. It decides nothing — it
 * reports which parked roadmaps are now resumable and hands that to a human.
 *
 * ## What it can and cannot decide, stated plainly
 *
 * A resume condition is prose. Two shapes are machine-decidable and the rest
 * are not, so the verdict set has three values rather than two:
 *
 *   - `fired`       — every roadmap the condition names has archived, or the
 *                     named step in a still-active roadmap is ticked.
 *   - `unmet`       — at least one named roadmap is still active with the
 *                     named step (or the whole file) still open.
 *   - `undecidable` — the condition names no roadmap this tree can resolve.
 *
 * `undecidable` is reported as its own count and never folded into "nothing
 * fired". A probe that reads 44 files, understands 12 of them and announces
 * silence is the gate-that-scans-nothing shape this repo has already paid for
 * once; the honest form says how much of the population it could actually read.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The markers this probe treats as a DEPENDENCY condition.
 *
 * Deliberately NARROWER than `lint_roadmap_later_disposition`'s set, which
 * also accepts a bare `trigger`. That lint answers "is a condition recorded",
 * where any of the five words is evidence; this probe answers "has it fired",
 * and in this tree `Trigger:` is overwhelmingly a *provenance* idiom —
 * "**Trigger:** Spun out of `road-to-governance-moat` (Iron Law 3 …)" names
 * where the roadmap came from, not what it waits for. Measured on the first
 * live run: accepting `trigger` reported that note as FIRED because the
 * roadmap it was spun out of had since archived. A probe whose headline
 * number is inflated by provenance mentions is worse than one that stays
 * quiet — it proposes resuming work on evidence that says nothing.
 */
const RESUME_LINE_RE = /\b(blocked until|resume when|blocked-until|resume-when)\b/i;

/**
 * Structure that says the condition has parts beyond its roadmap references.
 *
 * `BOTH`, an `AND`, or an enumerated `(1)` / `(a)` list means the author wrote
 * a conjunction, and this probe can only read one conjunct — the roadmap
 * dispositions. Reporting FIRED because that conjunct came true would claim
 * the whole condition on a third of the evidence. Measured on the first live
 * run: `later/road-to-deferred-rule-retriever.md` waits on three archived
 * roadmaps AND three demand signals no filesystem check can see.
 */
const COMPOUND_RE = /\bBOTH\b|\bAND\b|\([1-9]\)|\([a-e]\)|`[ \t]*\+|\+[ \t]*`/;

/**
 * A bolded field label that ENDS the condition.
 *
 * Park notes carry sibling fields in the same blockquote — `**Origin:**`,
 * `**Owner:**`, `**Context, not prerequisites:**` — and swallowing them turns
 * every roadmap the note credits into a claimed dependency. Measured on the
 * first live run: `later/road-to-per-workspace-license-policy.md` waits on "a
 * real consumer repo hits the v1 escalation" and merely *cites* the roadmap it
 * was spun out of under `**Origin:**`; the probe read that citation, found it
 * archived, and reported the note resumable.
 *
 * Same terminator discipline `_blockerField` uses in the dashboard parser, and
 * for the same reason: a field ends where the next one begins.
 */
const FIELD_LABEL_RE = /\*\*[^*]+:\*\*/;
/** A roadmap slug as written in prose, with or without the `.md` suffix. */
const ROADMAP_REF_RE = /\broad-to-[a-z0-9][a-z0-9-]*\b/g;
/**
 * A step reference: `P2.1`, `Phase 2.1`, or a bare `2.1`.
 *
 * The bare form is deliberately last and deliberately narrow — two digits
 * around a dot. Widening it to match a version number or a percentage would
 * make the probe claim to test something it is not reading.
 */
const STEP_REF_RE = /\b(?:P|Phase[ \t]+)?(\d+\.\d+)\b/;

type Disposition = 'active' | 'archive' | 'later' | 'skipped' | 'missing';
type Verdict = 'fired' | 'unmet' | 'undecidable';

interface ResumeFinding {
    /** Path relative to the roadmap root, e.g. `later/road-to-x.md`. */
    file: string;
    /** The resume-condition sentence, as authored. */
    condition: string;
    /** Roadmap slugs the condition names, excluding the parked file itself. */
    refs: string[];
    verdict: Verdict;
    /** One clause naming what decided it — always populated. */
    why: string;
}

function _read(p: string): string {
    try {
        return fs.readFileSync(p, 'utf-8');
    } catch {
        return '';
    }
}

function _exists(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Where a roadmap slug currently lives.
 *
 * `missing` is a real answer and is NOT read as "closed": a slug that resolves
 * nowhere is a broken reference in the park note, and reporting it as fired
 * would resume a roadmap on the strength of a typo.
 */
function roadmapDisposition(roadmapRoot: string, slug: string): Disposition {
    const name = `${slug}.md`;
    if (_exists(path.join(roadmapRoot, name))) {
        return 'active';
    }
    for (const dir of ['archive', 'later', 'skipped'] as const) {
        if (_exists(path.join(roadmapRoot, dir, name))) {
            return dir;
        }
    }
    return 'missing';
}

/**
 * The resume-condition sentence of a park note.
 *
 * Park notes are blockquotes that wrap, so the marker line alone truncates the
 * condition mid-sentence — the same defect `_blockerTodo` and the legacy
 * blocked-until parser both had to fix. Continue through following quoted
 * lines until the quote block breaks.
 */
function extractCondition(text: string): string {
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex((l) => RESUME_LINE_RE.test(l));
    if (start === -1) {
        return '';
    }
    const parts: string[] = [_strip(lines[start] as string)];
    for (let i = start + 1; i < lines.length; i++) {
        const l = _strip(lines[i] as string);
        // The condition ends at the end of the quote block or a blank quoted
        // line — a park note routinely carries several paragraphs of context
        // after it, and swallowing those would turn every mentioned roadmap
        // into a claimed dependency.
        if (!l.startsWith('>')) {
            break;
        }
        const body = _strip(l.replace(/^>[ \t]?/, ''));
        if (body === '') {
            break;
        }
        parts.push(body);
    }
    const joined = parts
        .map((p) => _strip(p.replace(/^>[ \t]?/, '')))
        .join(' ')
        .trim();
    return _truncateAtNextField(joined);
}

/**
 * Cut the condition at the first bolded label that is not a resume marker.
 *
 * The resume marker itself is bolded (`**Resume when …**`), so the scan starts
 * after it and keeps any further label only when it is another resume marker —
 * a note that writes `**Blocked until:** … **Resume when** …` is stating one
 * condition twice, not two fields.
 */
function _truncateAtNextField(condition: string): string {
    let cut = condition.length;
    const re = new RegExp(FIELD_LABEL_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(condition)) !== null) {
        const label = m[0] as string;
        if (RESUME_LINE_RE.test(label)) {
            continue;
        }
        // A label at offset 0 would cut the condition to nothing; the marker
        // line legitimately opens with one in notes shaped `**Blocked until:**`.
        if (m.index === 0) {
            continue;
        }
        cut = m.index;
        break;
    }
    return _strip(condition.slice(0, cut));
}

function _strip(s: string): string {
    return s.replace(/^[ \t\f\v]+|[ \t\f\v\r]+$/g, '');
}

/** Roadmap slugs named by the condition, minus the parked file's own slug. */
function referencedRoadmaps(condition: string, ownSlug: string): string[] {
    const out = new Set<string>();
    ROADMAP_REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ROADMAP_REF_RE.exec(condition)) !== null) {
        const slug = (m[0] as string).replace(/\.md$/, '');
        if (slug !== ownSlug) {
            out.add(slug);
        }
    }
    return [...out].sort();
}

/** Is `stepId` (e.g. `2.1`) ticked in `text`? `null` when it is not found. */
function stepIsDone(text: string, stepId: string): boolean | null {
    const escaped = stepId.replace('.', '\\.');
    const re = new RegExp(`^[ \\t]*-[ \\t]*\\[([ xX~-])\\][^\\n]*\\b(?:P|Phase[ \\t]+)?${escaped}\\b`, 'm');
    const m = re.exec(text);
    if (!m) {
        return null;
    }
    return (m[1] as string).toLowerCase() === 'x';
}

/**
 * Probe every park note under `later/`.
 *
 * Pure over the filesystem it is handed, so the tests point it at a fixture
 * tree rather than the live estate — a probe whose only test is the live tree
 * stops testing anything the day the live tree changes.
 */
function probeLater(roadmapRoot: string): ResumeFinding[] {
    const laterDir = path.join(roadmapRoot, 'later');
    let entries: string[];
    try {
        entries = fs
            .readdirSync(laterDir, { withFileTypes: true })
            .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
            .map((e) => e.name)
            .sort();
    } catch {
        return [];
    }

    const findings: ResumeFinding[] = [];
    for (const name of entries) {
        const text = _read(path.join(laterDir, name));
        const ownSlug = name.replace(/\.md$/, '');
        const condition = extractCondition(text);
        if (condition === '') {
            findings.push({
                file: `later/${name}`,
                condition: '',
                refs: [],
                verdict: 'undecidable',
                why: 'no resume-condition line — lint_roadmap_later_disposition owns that gap',
            });
            continue;
        }
        if (COMPOUND_RE.test(condition)) {
            findings.push({
                file: `later/${name}`,
                condition,
                refs: referencedRoadmaps(condition, ownSlug),
                verdict: 'undecidable',
                why: 'compound condition — the probe reads the roadmap references and not the rest',
            });
            continue;
        }
        const refs = referencedRoadmaps(condition, ownSlug);
        if (refs.length === 0) {
            findings.push({
                file: `later/${name}`,
                condition,
                refs,
                verdict: 'undecidable',
                why: 'the condition names no roadmap this tree can resolve',
            });
            continue;
        }

        const stepMatch = STEP_REF_RE.exec(condition);
        const stepId = stepMatch ? (stepMatch[1] as string) : null;

        const reasons: string[] = [];
        let unmet = false;
        let unresolvable = false;
        for (const slug of refs) {
            const where = roadmapDisposition(roadmapRoot, slug);
            if (where === 'archive') {
                reasons.push(`${slug} archived`);
                continue;
            }
            if (where === 'missing') {
                unresolvable = true;
                reasons.push(`${slug} resolves nowhere`);
                continue;
            }
            if (where === 'active' && stepId !== null) {
                const done = stepIsDone(_read(path.join(roadmapRoot, `${slug}.md`)), stepId);
                if (done === true) {
                    reasons.push(`${slug} step ${stepId} is ticked`);
                    continue;
                }
                reasons.push(done === null ? `${slug} has no step ${stepId}` : `${slug} step ${stepId} still open`);
                unmet = true;
                continue;
            }
            reasons.push(`${slug} still in ${where}`);
            unmet = true;
        }

        // Conservative on purpose: a compound condition fires only when every
        // roadmap it names has closed. Resuming on a partial match would put
        // the file back into the active tree still waiting on something.
        const verdict: Verdict = unmet ? 'unmet' : unresolvable ? 'undecidable' : 'fired';
        findings.push({
            file: `later/${name}`,
            condition,
            refs,
            verdict,
            why: reasons.join('; '),
        });
    }
    return findings;
}

export {
    extractCondition,
    probeLater,
    referencedRoadmaps,
    roadmapDisposition,
    stepIsDone,
    RESUME_LINE_RE,
};
export type { Disposition, ResumeFinding, Verdict };
