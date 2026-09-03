/**
 * Shared release-highlight classifier — one definition of the curated head's
 * labels and of the span → category derivation.
 *
 * Used by BOTH sides on purpose:
 *
 * - the generator (`release.ts`) pre-fills the curated head with what it can
 *   substantiate from the span;
 * - the gate (`check_release_highlights.ts`) blocks a `_none_` the span
 *   contradicts.
 *
 * Why shared instead of duplicated. Before this module the generator emitted
 * `_none_` for all five fields while the gate rejected exactly that default
 * the moment the span carried evidence. Every release of this package touches
 * `src/rules/` or `src/scripts/schemas/`, so "Behaviour changes" is always
 * substantiated and every release PR was red on its FIRST run by construction
 * — 9.17.0 (run 30871194277) and 9.18.0 (run 30909511315) both hit it, on the
 * same step, for the same reason.
 *
 * This is not a weaker gate. The generator no longer manufactures a claim it
 * cannot support, and the gate keeps full teeth for the failure it was built
 * for: a human editing a substantiated line back down to `_none_`, which is
 * exactly what produced the false 9.13.0 and 9.14.0 heads. Machine-written
 * `_none_` was never that failure; it was noise standing in front of it.
 */
import { spawnSync } from 'node:child_process';

import { CURATED_HEAD_INSTRUCTION } from './release_material.js';

/** The five curated labels, in the order an operator reads them. */
export const HEAD_LABELS: readonly string[] = [
    'Behaviour changes',
    'Default changes + migration',
    'Security and correctness',
    'Honest nulls',
    'Known limitations',
];

export const HEAD_NONE = '_none_';

/**
 * Prefix marking a head line the generator derived rather than a human wrote.
 *
 * Machine-checkable so the gate can REFUSE when one survives to merge, and
 * readable so the line still says something true to anyone who ships it
 * unedited. It is not a placeholder token: the line it introduces carries real
 * evidence (the reason plus the citing SHAs), so nothing here is
 * wrong-if-shipped — only unpolished-if-unedited.
 *
 * **REVERSED 2026-09-01 — "only unpolished-if-unedited" no longer implies
 * "therefore advisory".** The clause above is kept because it is TRUE, and the
 * conclusion that used to follow from it is the part that was falsified: the
 * gate warned, and the marker shipped anyway in five consecutive released
 * sections (14.9.0 through 14.13.0, eighteen lines, re-derived at
 * `b50b27281`). `check_release_highlights` now exits non-zero on a marker in
 * the section under release, and the sibling annotation in that file's header
 * carries the full reversal.
 *
 * **Instructing authority:** the maintainer's closing instruction in the
 * 2026-09-a inbox round, carried into
 * `agents/roadmaps/archive/road-to-publication-integrity-hard-fail.md` § Phase 1.
 *
 * Nothing about the marker's own shape changes here — it is still one
 * definition, still shared with the generator that writes it.
 */
export const DERIVED_MARKER = '_auto-derived, rewrite before merge:_';

/** Cap on cited SHAs per line, so a wide release cannot unbound the head. */
export const DERIVED_SHA_CAP = 6;

export interface SpanCommit {
    sha: string;
    subject: string;
    body: string;
    /** `A` / `M` / `D` / `R…` status per touched path. */
    files: ReadonlyArray<{ status: string; path: string }>;
    breaking: boolean;
}

/** One derived hit: the commit that substantiates a label. */
export interface CategoryHit {
    sha: string;
    /** Rendered detail — the subject, plus a removed-surface note when any. */
    text: string;
}

/** Public artefact trees whose deletions count as removed public surface. */
const _PUBLIC_SURFACE_PREFIXES = [
    'src/skills/',
    'src/rules/',
    'src/agent-src/commands/',
    'src/domains/',
];

const _RULE_OR_SCHEMA_PREFIXES = ['src/rules/', 'src/scripts/schemas/'];

/**
 * Paths whose repair is a correctness fix to shipped *behaviour* rather than a
 * record of one. The distinction is load-bearing: 43 % of `fix(...)` commits
 * over the six spans measured in
 * `agents/evidence/analysis/release-head-derivation-recall.md` touch no
 * executable file at all — `52d7fe1 fix(worktrees): the inventory
 * misclassifies from inside a worktree, totally` changes two markdown files and
 * repairs nothing. Keying on the touched surface is what separates a bug fix
 * from a bug report, and it moves hand-judged precision from 54 % to 96 %.
 */
const _EXECUTABLE_SUFFIX = /\.(?:ts|tsx|js|mjs|cjs|sh|py)$/u;
const _EXECUTABLE_PREFIXES = ['.github/workflows/', '.github/actions/'];

/**
 * Shebang entry points with no extension, which a suffix test cannot see. An
 * exact set rather than a heuristic: the alternative is reading file contents,
 * which a span commit does not carry.
 *
 * The recall limit that remains, named rather than left for a reader to
 * discover: a NEW extensionless entry point is invisible until it is added
 * here. Precision was measured over six spans; this predicate's recall was not,
 * and adding to this set is the maintenance that follows a new entry point.
 */
const _EXECUTABLE_EXACT: ReadonlySet<string> = new Set([
    'scripts-run',
    'src/scripts/agent-config',
]);

function _touches_executable(files: SpanCommit['files']): boolean {
    return files.some(
        (f) =>
            _EXECUTABLE_SUFFIX.test(f.path) ||
            _EXECUTABLE_EXACT.has(f.path) ||
            _EXECUTABLE_PREFIXES.some((p) => f.path.startsWith(p)),
    );
}

/**
 * Conventional-commit type, lower-cased, or `''` when the subject carries no
 * conventional prefix.
 *
 * Two things this deliberately does, both of which an earlier version got
 * wrong. It requires the conventional `:` separator, so `fix the flaky runner`
 * is not classified as type `fix` — otherwise this function disagrees with the
 * scope regex three lines below it and with every prose description of the
 * rule. And it recognises `Revert "<subject>"`, the form `git revert` writes by
 * default, which is not conventional at all: without it the documented revert
 * half only ever applied to a hand-written `revert(scope):`, and a revert of
 * shipped behaviour is the commit class most likely to be a correctness repair.
 */
function _commit_type(subject: string): string {
    if (/^Revert\s+"/u.test(subject)) {
        return 'revert';
    }
    const m = /^(\w+)(?:\([^)]*\))?!?:/u.exec(subject);
    return m ? m[1]!.toLowerCase() : '';
}

/**
 * Recorded-null forms beyond the literal marker, taken from real subjects and
 * bodies over the six measured spans rather than invented: a waived-rather-than-
 * met condition, a published or recorded null, an archival on a roadmap's own
 * falsifier. All six commits these add across the six spans are true positives.
 */
const _NULL_FORMS: readonly RegExp[] = [
    /honest[ -]null/iu,
    /\bwaived,? (?:rather than|not) met\b/iu,
    /\bsoak was waived\b/iu,
    // The trailing lookahead keeps a recorded *result* apart from a field that
    // merely holds null. This pattern is applied to the body as well as the
    // subject, and a body is where "records null token_delta" appears — a
    // telemetry field, not a null result. Excluding an identifier-shaped token
    // after `null` costs nothing real: "records the null result" and "closed as
    // a published null" both still derive. The lookahead is deliberately
    // SAME-LINE (`[ \t]`, never `\s`): the first version used `\s+` and dropped
    // a true positive, because 92f9b9a ends its subject on "closed as a
    // published null" and its body then opens with `count_open reached 0` — an
    // identifier on the NEXT line, which `\s+` happily crossed. The residual
    // limit, named rather than left to be discovered: a field name with no
    // underscore ("records null delta") is still caught.
    /\b(?:publish(?:es|ed|ing)?|record(?:s|ed|ing)?|report(?:s|ed|ing)?) (?:the |an |a |its )?(?:honest )?null\b(?![ \t]+`?[a-z][a-z0-9]*_[a-z0-9_]*)/iu,
    /\bnull(?: result)? (?:stands|is the answer)\b/iu,
    /\bon (?:its|the) own falsifier\b/iu,
];

/**
 * Why a label fired, in generator-facing prose. Keyed by label; a label absent
 * here is never derived (`Known limitations` is pure prose, not checkable).
 */
const _DERIVED_REASON: Readonly<Record<string, string>> = {
    'Behaviour changes': 'rule/schema diffs, breaking commits or removed public surface',
    'Default changes + migration': 'commits naming a default, migration or migrate',
    'Security and correctness': 'security-scoped commits or fixes to executable surface',
    'Honest nulls': 'commits recording a null, waived or falsified result',
};

/**
 * Derive evidence per curated label from the span. Rules per label:
 *
 * - Security and correctness: conventional scope matching /secur/i, or the
 *   whole word "security" in the subject — plus the *correctness* half the
 *   label names: a `fix` or `revert` commit touching executable surface.
 * - Behaviour changes: breaking (`!` / BREAKING CHANGE) commits, diffs
 *   touching `src/rules/` or `src/scripts/schemas/`, and deletions under the
 *   public artefact trees (removed public surface).
 * - Default changes + migration: subject carrying the whole word "default",
 *   "migration", or "migrate".
 * - Honest nulls: subject or body carrying one of the recorded-null forms —
 *   the literal marker, a waived-rather-than-met condition, a published or
 *   recorded null, an archival on a roadmap's own falsifier.
 * - Known limitations: never derived — pure prose, not gate-checkable.
 *
 * Derivation is deliberately conservative: a false red makes every release
 * annoying, a miss only returns the head to the pre-gate state. Conservative
 * is not the same as silent, and two labels had crossed that line: measured
 * over the six spans in
 * `agents/evidence/analysis/release-head-derivation-recall.md`, `Security and
 * correctness` fired **1 of 45** hand-confirmed in-category commits and
 * `Honest nulls` **3 of 9**, so the
 * curated `_none_` shipped uncontested where the span carried the evidence.
 * The widening is aimed at those two and measured before it landed; the naive
 * "any `fix(` counts" alternative was rejected on data (54 % precision against
 * 96 %), not on taste.
 */
export function derive_category_hits(
    commits: readonly SpanCommit[],
): Record<string, CategoryHit[]> {
    const out: Record<string, CategoryHit[]> = {};
    for (const label of HEAD_LABELS) {
        out[label] = [];
    }
    for (const c of commits) {
        const scopeMatch = /^\w+\(([^)]*)\)!?:/u.exec(c.subject);
        const scope = scopeMatch ? scopeMatch[1]! : '';
        const type = _commit_type(c.subject);
        const correctnessFix =
            (type === 'fix' || type === 'revert') && _touches_executable(c.files);
        if (/secur/iu.test(scope) || /\bsecurity\b/iu.test(c.subject) || correctnessFix) {
            out['Security and correctness']!.push({ sha: c.sha, text: c.subject });
        }
        const removedPublic = c.files.filter(
            (f) =>
                f.status.startsWith('D') &&
                _PUBLIC_SURFACE_PREFIXES.some((p) => f.path.startsWith(p)),
        );
        const ruleOrSchema = c.files.some((f) =>
            _RULE_OR_SCHEMA_PREFIXES.some((p) => f.path.startsWith(p)),
        );
        if (c.breaking || ruleOrSchema || removedPublic.length > 0) {
            const text =
                removedPublic.length > 0
                    ? `${c.subject} (removes ${removedPublic.map((f) => f.path).join(', ')})`
                    : c.subject;
            out['Behaviour changes']!.push({ sha: c.sha, text });
        }
        if (/\b(default|migration|migrate)\b/iu.test(c.subject)) {
            out['Default changes + migration']!.push({ sha: c.sha, text: c.subject });
        }
        const subjectAndBody = `${c.subject}\n${c.body}`;
        if (_NULL_FORMS.some((re) => re.test(subjectAndBody))) {
            out['Honest nulls']!.push({ sha: c.sha, text: c.subject });
        }
    }
    return out;
}

/**
 * String-rendered evidence per label (`<sha7> <detail>`), the shape the gate
 * reports to a human. Derived from the structured hits so the two can never
 * disagree.
 */
export function derive_categories(commits: readonly SpanCommit[]): Record<string, string[]> {
    const hits = derive_category_hits(commits);
    const out: Record<string, string[]> = {};
    for (const label of HEAD_LABELS) {
        out[label] = (hits[label] ?? []).map((h) => `${h.sha.slice(0, 7)} ${h.text}`);
    }
    return out;
}

/**
 * Pre-fill values for the curated head, one line per SUBSTANTIATED label.
 *
 * A label with no evidence is omitted, so the caller's `_none_` default still
 * applies where `_none_` is the true answer. One line per label keeps the
 * rendered head inside its cap; citations are capped at `DERIVED_SHA_CAP` with
 * an explicit remainder count rather than a silent truncation.
 *
 * **PUBLISHABLE BY DEFAULT since 2026-09-03, and this is the third position
 * this line has held.** It shipped `DERIVED_MARKER` plus a CATEGORY
 * DESCRIPTION — "rule/schema diffs, breaking commits or removed public surface
 * in 5a3b7c5". The 2026-09-01 flip then made that marker a hard refusal, and
 * the combination had a consequence nobody priced: every release of this
 * package touches `src/rules/` or `src/scripts/schemas/`, so **Behaviour
 * changes** is always substantiated, so the generator always wrote a line the
 * gate always refused. Every release halted, by construction. That was
 * recorded as "the cadence the flip chose"; the maintainer's instruction of
 * 2026-09-03 — *"fix the bug so this stops happening"* — is the authority for
 * removing it.
 *
 * The fix is not a weaker gate, and it is not the marker moving somewhere
 * cheaper (that was 2026-09-03's first attempt, `guard_release_curation`,
 * which relocated the halt without removing it). It is the writer no longer
 * emitting text that cannot ship. Two changes, and the first is what makes the
 * second honest:
 *
 * 1. The line now states the COMMIT SUBJECTS behind each category, not the
 *    name of the category's own detection rule. "hooks:effect reports whether
 *    a bound concern fires (b0a03a7)" is a claim a reader can use; "rule/schema
 *    diffs in b0a03a7" is a restatement of why the classifier fired.
 * 2. `DERIVED_MARKER` is gone from the emission, so nothing unpublishable is
 *    ever written and no release halts on the writer's own output.
 *
 * What is deliberately NOT relaxed: `highlight_contradictions` still refuses a
 * human editing a substantiated line down to `_none_`, which is the failure the
 * false 9.13.0 and 9.14.0 heads actually were; and the marker constant and its
 * four guard sites stay, now covering only a marker somebody writes BY HAND.
 * The honest cost of this change, stated rather than left to be discovered: the
 * head is a categorised view of the span rather than curated prose, and it
 * ships without a human having read it. An operator who wants better prose
 * still edits it — they are no longer STOPPED until they do.
 */
/**
 * A commit subject reduced to the claim inside it.
 *
 * Drops the conventional-commit `type(scope):` prefix, because "feat(hooks):"
 * is metadata about the commit and the changelog's own commit lists already
 * carry it — what a highlight line needs is the sentence after the colon. Keeps
 * the subject otherwise verbatim: rewording it here would make the head a
 * paraphrase of the span rather than a citation of it, and the whole point of
 * this module is that the two cannot disagree.
 */
function _claim_text(subject: string): string {
    return subject.replace(/^[a-z]+(?:\([^)]*\))?!?:\s*/u, '').trim();
}

export function render_derived_head_values(
    hits: Readonly<Record<string, readonly CategoryHit[]>>,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const label of HEAD_LABELS) {
        const reason = _DERIVED_REASON[label];
        const ev = hits[label] ?? [];
        if (!reason || ev.length === 0) {
            continue;
        }
        const shown = ev.slice(0, DERIVED_SHA_CAP);
        const remainder = ev.length - shown.length;
        const more = remainder > 0 ? `; +${String(remainder)} more` : '';
        const cited = shown
            .map((h) => `${_claim_text(h.text)} (${h.sha.slice(0, 7)})`)
            .join('; ');
        // `reason` still names the classifier that fired, kept as the fallback
        // for a hit whose subject renders empty after trimming — a subject that
        // is nothing but a conventional-commit prefix. Without it the line
        // would read "( b0a03a7)".
        out[label] = cited ? `${cited}${more}.` : `${reason} in ${shown
            .map((h) => h.sha.slice(0, 7))
            .join(', ')}${more}.`;
    }
    return out;
}

/**
 * Reasons the section under release must NOT be published, in the order a
 * reader should act on them. Empty means nothing here blocks publication.
 *
 * Added 2026-09-01 for roadmap § 3.1. It exists because the two IRREVERSIBLE
 * transitions — the annotated tag and the GitHub Release body — happen inside
 * `release.ts` after the PR gate has already passed, and nothing re-read the
 * section between them. `check_release_highlights` guards the PR; this guards
 * the publish.
 *
 * **It takes a section body, never a path and never a repository.** A guard
 * that reads a file decides for itself what it is guarding, and the two
 * refused earlier attempts both died there: one placed the check inside a pure
 * formatter, which has no idea whether it is publishing, and one read the live
 * changelog from a drill fixture. The caller cuts the section and owns the
 * decision to publish; this function only answers whether that text is
 * publishable.
 *
 * **Two markers since 2026-09-01, and the second one had to wait for a writer
 * change.** This function used to check `DERIVED_MARKER` only, and said so:
 * the generator still wrote its authoring comment into every section it cut,
 * so refusing on that comment would have redded every release on its first run
 * — Risk 1 of the roadmap, reproduced exactly. Roadmap § Phase 2 Option A
 * removed the emission (`render_release_head` in `release.ts`), which is what
 * makes refusing on it safe. The order was forced and it is the reason the
 * check arrives second rather than late.
 *
 * `CURATED_HEAD_INSTRUCTION` is a named sentinel imported from the module that
 * defines it — never a shape match over comment prose, which would reject
 * unrelated legitimate comments and miss this one after a reword.
 *
 * `where` names the branch the remedy edit belongs on, because the same
 * blockers are now read at a FOURTH site that is not on `main`:
 * `guard_release_branch_push` refuses the release branch's first push, where
 * the file to edit is on `release/X.Y.Z`. One definition of the blockers with a
 * parameterised remedy beats a second copy of the message that drifts.
 */
export function publication_blockers(
    sectionBody: string,
    version: string,
    where = '`main`',
): string[] {
    const out: string[] = [];
    if (sectionBody.includes(DERIVED_MARKER)) {
        out.push(
            `the ${version} section still carries \`${DERIVED_MARKER}\` — the generator's ` +
                `draft head, not a curated claim. Rewrite those line(s) on ${where} and re-run.`,
        );
    }
    if (sectionBody.includes(CURATED_HEAD_INSTRUCTION)) {
        out.push(
            `the ${version} section still carries the authoring instruction ` +
                `(\`${CURATED_HEAD_INSTRUCTION}\`) — a reminder to the releaser, not ` +
                'release content, and `CHANGELOG.md` is published to npm. Delete that ' +
                'comment line from the section and re-run.',
        );
    }
    return out;
}

/** Labels whose curated value is still the generator's unedited draft. */
export function stale_draft_labels(
    curated: Readonly<Record<string, string>>,
): string[] {
    return HEAD_LABELS.filter((l) => (curated[l] ?? '').includes(DERIVED_MARKER));
}

// ─── git span collection ────────────────────────────────────────────────────

const _RECORD = '\u001e';
const _FIELD = '\u001f';

export function parse_git_log(raw: string): SpanCommit[] {
    const commits: SpanCommit[] = [];
    for (const record of raw.split(_RECORD)) {
        if (!record.trim()) {
            continue;
        }
        const [head, ...restLines] = record.split('\n');
        const parts = (head ?? '').split(_FIELD);
        if (parts.length < 3) {
            continue;
        }
        const sha = parts[0]!.trim();
        const subject = parts[1]!;
        const bodyParts: string[] = [parts.slice(2).join(_FIELD)];
        const files: Array<{ status: string; path: string }> = [];
        for (const line of restLines) {
            const m = /^([A-Z]\d*)\t(.+)$/u.exec(line);
            if (m) {
                // Renames carry two paths; the last tab field is the new path,
                // the first the old — record both so a rename out of a public
                // tree still counts its origin path.
                const segs = m[2]!.split('\t');
                for (const p of segs) {
                    files.push({ status: m[1]!, path: p });
                }
            } else {
                // %b is multi-line — everything that is not a name-status
                // line is body continuation (honest-null markers live there).
                bodyParts.push(line);
            }
        }
        const body = bodyParts.join('\n');
        commits.push({
            sha,
            subject,
            body,
            files,
            breaking: /^\w+(\([^)]*\))?!:/u.test(subject) || /BREAKING CHANGE/u.test(body),
        });
    }
    return commits;
}

/** `git log` arguments for a span, shared so both callers read one format. */
export function span_log_args(from: string | null, to: string): string[] {
    return [
        'log',
        from ? `${from}..${to}` : to,
        '--no-merges',
        '--name-status',
        '--format=%x1e%H%x1f%s%x1f%b',
    ];
}

/**
 * Collect the span. Throws on git failure so a caller can decide whether the
 * derivation is load-bearing (the gate) or best-effort (the generator).
 */
export function collect_span_commits(from: string | null, to: string, cwd: string): SpanCommit[] {
    const r = spawnSync('git', span_log_args(from, to), {
        encoding: 'utf-8',
        cwd,
        maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status !== 0) {
        throw new Error(`git ${span_log_args(from, to).join(' ')} failed: ${r.stderr}`);
    }
    return parse_git_log(r.stdout);
}

/** Latest reachable release tag before `ref`, or null when there is none. */
export function previous_release_tag(ref: string, cwd: string): string | null {
    const r = spawnSync(
        'git',
        ['describe', '--tags', '--abbrev=0', '--match', '[0-9]*.[0-9]*.[0-9]*', `${ref}^`],
        { encoding: 'utf-8', cwd },
    );
    if (r.status !== 0) {
        return null;
    }
    const tag = r.stdout.trim();
    return tag === '' ? null : tag;
}
