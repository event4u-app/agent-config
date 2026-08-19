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
 * A resume condition is prose. TWO shapes are machine-decidable — a roadmap
 * reference, and a single repo-relative file path under an existence predicate
 * — and the rest are not, so the verdict set has three values rather than two:
 *
 *   - `fired`       — every roadmap the condition names has archived, or the
 *                     named step in a still-active roadmap is ticked; or the
 *                     single path it names under `exists` is there.
 *   - `unmet`       — at least one named roadmap is still active with the
 *                     named step (or the whole file) still open; or the single
 *                     path it names under `exists` is absent.
 *   - `undecidable` — the condition names neither, names both (a conjunction
 *                     this probe can only half-weigh), names two of either, or
 *                     states a predicate other than existence over its path.
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
 *
 * Case-INSENSITIVE, and it was not for one revision: every sibling regex here
 * carries `i` and this one did not, so a lowercase "and" walked through the
 * guard and its note would have fired on the single conjunct the probe can
 * resolve — the exact over-report the guard exists to stop.
 */
const COMPOUND_RE = /\bboth\b|\band\b|\([1-9]\)|\([a-e]\)|`[ \t]*\+|\+[ \t]*`/i;

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
 * A repo-relative path named inside backticks — the second decidable form.
 *
 * `PARK-PROBEABLE` (`road-to-estate-drawdown` Phase 2) means the resume
 * condition can be tested by a script, and until this existed the probe could
 * decide exactly one phrasing: a roadmap slug. Measured 2026-08-19 on the live
 * estate, 42 of 44 park notes were `undecidable`, and the batch-1 sweep could
 * only add six more — a verdict whose name promised a probe that did not read
 * the conditions it was producing.
 *
 * Deliberately narrow in three ways, because a false FIRED un-parks live work:
 * the path must be **inside backticks** (prose that merely contains a slash is
 * not a condition), it must start at a **known top-level repo directory** and
 * end in a **file extension**, and the clause must name **exactly one** — two
 * paths are a conjunction this function cannot weigh, and `COMPOUND_RE` does
 * not catch a comma.
 *
 * The extension requirement is what keeps a *directory* out. `agents/evidence/`
 * exists in every checkout, so "recorded under `agents/evidence/`" is not a
 * condition a probe can decide — and since `_exists` tests `isFile()`, matching
 * it would have reported "does not exist" about a directory that does. A
 * directory-shaped condition stays `undecidable`, which is the honest verdict.
 */
const REPO_PATH_RE = /`((?:agents|docs|src|tests|internal|scripts|evals|\.github)\/[A-Za-z0-9._\-/]*[A-Za-z0-9_\-]\.[A-Za-z0-9]{2,5})`/g;
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
    const lines = _blankFencedCode(text).split(/\r?\n/);
    // The marker must be inside the park note's blockquote. Searching the whole
    // file let ordinary body prose containing "blocked until" become "the
    // condition", and the continuation loop then read from the wrong anchor.
    const start = lines.findIndex(
        (l) => _strip(l).startsWith('>') && RESUME_LINE_RE.test(l),
    );
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

/**
 * Blank fenced code, preserving line count.
 *
 * A park note that SHOWS the resume-condition syntax in a fenced example is
 * documenting it, not stating one — the same reason `parse_blockers` and
 * `lint_roadmap_blockers` both strip fences before they look for blockers.
 */
function _blankFencedCode(text: string): string {
    return text.replace(/^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm, (m) =>
        '\n'.repeat((m.match(/\n/g) ?? []).length),
    );
}

/**
 * The head of `s` up to its first sentence terminator OUTSIDE backticks.
 *
 * A naive character-class scan that stops at any dot cuts inside `foo.md` or
 * inside a step id like `3.3`, which truncates the clause mid-span and hides
 * the very path or step the condition names. Measured 2026-08-19: three of the six park notes written by
 * `road-to-estate-drawdown` Phase 2 batch 1 lost their backticked path this
 * way, and the probe then reported "names no roadmap this tree can resolve"
 * about a condition that named a file.
 */
function _sentenceHead(s: string): string {
    // An ODD backtick count means the span never closes, and toggling on it
    // would leave `inCode` stuck true for the whole remainder — the commentary
    // paragraph then becomes the clause, and a path mentioned only in that
    // commentary could decide the verdict. Fall back to the plain scan, which
    // cuts at the first terminator and is the conservative direction.
    const balanced = (s.match(/`/g) ?? []).length % 2 === 0;
    let inCode = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i] as string;
        if (ch === '`' && balanced) {
            inCode = !inCode;
            continue;
        }
        if (!inCode && (ch === '.' || ch === '—' || ch === '–')) {
            return s.slice(0, i);
        }
    }
    return s;
}

/**
 * The condition CLAUSE inside the condition text.
 *
 * Park notes bold the condition and then explain it in prose:
 * `**Resume when P2.1 of \`road-to-x\` closes** — the catalogue-logging
 * falsifier that measures whether … and the report itself declines to …`.
 * The clause is the bolded span; everything after it is commentary.
 *
 * The distinction is load-bearing and was measured the hard way. Making
 * `COMPOUND_RE` case-insensitive (correct in itself — the flag was missing)
 * immediately produced the opposite false result: an ordinary "and" in the
 * *explanation* read as a conjunction of conditions, and the one genuinely
 * fired note in the tree dropped out. Analysing the clause rather than the
 * paragraph is what makes a case-insensitive conjunction test safe.
 *
 * Falls back to the whole string when no bolded span carries the marker — a
 * note that writes its condition unbolded gets the blunt reading, which is the
 * conservative direction.
 */
function conditionClause(condition: string): string {
    const re = /\*\*([^*]+)\*\*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(condition)) !== null) {
        const span = m[1] as string;
        if (RESUME_LINE_RE.test(span)) {
            // The bolded span sometimes stops before the payload
            // (`**Resume when** that pruning lands`), so take the span plus the
            // remainder of its sentence — up to an em dash or a full stop.
            const after = condition.slice(m.index + m[0].length);
            return `${span}${_sentenceHead(after)}`;
        }
    }
    return condition;
}

/**
 * The clause's predicate is EXISTENCE, not some property of the file's content.
 *
 * Without this the path branch would answer a question the condition did not
 * ask. Measured 2026-08-19 while writing it: `road-to-catalogue-host-fit` waits
 * until `agents/evidence/metrics/skill-catalogue.jsonl` *holds at least 20
 * observations*; the file exists today with 7 lines, so an existence test would
 * have reported FIRED and un-parked a roadmap whose bar is 13 observations away.
 * A content bar is decidable — by `capture_skill_catalogue --cadence` — but not
 * by this probe, and `undecidable` is the honest verdict for it.
 *
 * The predicate is bound POSITIONALLY to the path rather than tested as a word
 * anywhere in the clause, because word-presence is not a predicate: `\`x.md\` no
 * longer exists` would have reported FIRED while the file was still there, and
 * `blocked until a workaround exists, see \`docs/x.md\`` would have paired the
 * word with a path it does not govern. Both shapes are regression tests.
 *
 * KNOWN LIMIT, stated rather than papered over: this probe reads the condition
 * AFTER `_truncateAtNextField`, so a content bar an author moves into a sibling
 * bolded field is invisible to it and the note decides as bare existence. That
 * is an authoring bypass no check here can see — the guard is that a resume
 * condition states its whole bar inside the condition, and it is model-carried.
 */
const EXISTENCE_PREDICATE_RE = /`(?:agents|docs|src|tests|internal|scripts|evals|\.github)\/[A-Za-z0-9._\-/]+`[ \t]*(?:currently[ \t]+)?exists\b/i;

/**
 * The single repo-relative path a condition names, or `null`.
 *
 * `null` for zero paths (nothing to test) and for two or more (a conjunction
 * this probe cannot weigh — reporting FIRED on the first would be the
 * partial-match resume the compound guard already refuses).
 */
function referencedPath(condition: string): string | null {
    if (!EXISTENCE_PREDICATE_RE.test(condition)) {
        return null;
    }
    const paths = _pathsIn(condition);
    return paths.length === 1 ? (paths[0] as string) : null;
}

/** Every distinct repo-relative file path a clause names, predicate or not. */
function _pathsIn(condition: string): string[] {
    REPO_PATH_RE.lastIndex = 0;
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = REPO_PATH_RE.exec(condition)) !== null) {
        found.add(m[1] as string);
    }
    return [...found].sort();
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

/**
 * Is `stepId` (e.g. `2.1`) ticked in `text`? `null` when it is not found.
 *
 * The id must sit in the step's LABEL position — immediately after the
 * checkbox, optionally bolded — not anywhere on the line. Matching it anywhere
 * meant a line like `- [x] **1.4** raise the cap from 2.0 to 2.1` decided the
 * verdict for step 2.1, and because `exec` returns the first match in the file
 * the wrong line won whenever it came first.
 */
function stepIsDone(text: string, stepId: string): boolean | null {
    const escaped = stepId.replace(/\./g, '\\.');
    const re = new RegExp(
        `^[ \\t]*-[ \\t]*\\[([ xX~-])\\][ \\t]*\\*{0,2}(?:P|Phase[ \\t]+)?${escaped}\\b`,
        'm',
    );
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
function probeLater(roadmapRoot: string, repoRootArg?: string): ResumeFinding[] {
    // Defaults to the repo that owns `agents/roadmaps/`. Passed explicitly by
    // the tests, whose fixture tree IS the roadmap root and has no repo above it.
    const repoRoot = repoRootArg ?? path.resolve(roadmapRoot, '..', '..');
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
        // Both tests read the CLAUSE, never the surrounding explanation: an
        // "and" or a roadmap name in the prose after the condition is
        // commentary, not a second conjunct and not a dependency.
        const clause = conditionClause(condition);
        if (COMPOUND_RE.test(clause)) {
            findings.push({
                file: `later/${name}`,
                condition,
                refs: referencedRoadmaps(clause, ownSlug),
                verdict: 'undecidable',
                why: 'compound condition — the probe reads the roadmap references and not the rest',
            });
            continue;
        }
        const refs = referencedRoadmaps(clause, ownSlug);
        // A clause naming a roadmap AND a path is a conjunction, and deciding it
        // on the roadmap half alone is the partial-match resume `COMPOUND_RE`
        // already refuses for two roadmaps. `COMPOUND_RE` does not close it —
        // a comma joins the two without an `and`, which is the same hole the
        // two-paths rule in `referencedPath` exists for. Refused symmetrically.
        if (refs.length > 0 && _pathsIn(clause).length > 0) {
            findings.push({
                file: `later/${name}`,
                condition,
                refs,
                verdict: 'undecidable',
                why: 'names a roadmap and a repo path — a conjunction the probe can only half-weigh',
            });
            continue;
        }
        if (refs.length === 0) {
            // Second decidable form: a single repo-relative path. `exists` is
            // the whole test — the condition says the artefact will appear, so
            // its appearance IS the firing, and no content check is implied.
            const rel = referencedPath(clause);
            if (rel !== null) {
                const there = _exists(path.join(repoRoot, rel));
                findings.push({
                    file: `later/${name}`,
                    condition,
                    refs,
                    verdict: there ? 'fired' : 'unmet',
                    why: there ? `${rel} exists` : `${rel} does not exist`,
                });
                continue;
            }
            findings.push({
                file: `later/${name}`,
                condition,
                refs,
                verdict: 'undecidable',
                why: 'the condition names no roadmap or repo path this tree can resolve',
            });
            continue;
        }

        const stepMatch = STEP_REF_RE.exec(clause);
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
    conditionClause,
    extractCondition,
    probeLater,
    referencedPath,
    referencedRoadmaps,
    roadmapDisposition,
    stepIsDone,
    RESUME_LINE_RE,
};
export type { Disposition, ResumeFinding, Verdict };
