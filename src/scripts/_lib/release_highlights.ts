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
 * Machine-checkable so the gate can warn when one survives to merge, and
 * readable so the line still says something true to anyone who ships it
 * unedited. It is not a placeholder token: the line it introduces carries real
 * evidence (the reason plus the citing SHAs), so nothing here is
 * wrong-if-shipped — only unpolished-if-unedited.
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
 * Why a label fired, in generator-facing prose. Keyed by label; a label absent
 * here is never derived (`Known limitations` is pure prose, not checkable).
 */
const _DERIVED_REASON: Readonly<Record<string, string>> = {
    'Behaviour changes': 'rule/schema diffs, breaking commits or removed public surface',
    'Default changes + migration': 'commits naming a default, migration or migrate',
    'Security and correctness': 'security-scoped commits',
    'Honest nulls': 'commits carrying an honest-null marker',
};

/**
 * Derive evidence per curated label from the span. Rules per label:
 *
 * - Security and correctness: conventional scope matching /secur/i, or the
 *   whole word "security" in the subject.
 * - Behaviour changes: breaking (`!` / BREAKING CHANGE) commits, diffs
 *   touching `src/rules/` or `src/scripts/schemas/`, and deletions under the
 *   public artefact trees (removed public surface).
 * - Default changes + migration: subject carrying the whole word "default",
 *   "migration", or "migrate".
 * - Honest nulls: subject or body carrying an "honest null" marker.
 * - Known limitations: never derived — pure prose, not gate-checkable.
 *
 * Derivation is deliberately conservative: a false red makes every release
 * annoying, a miss only returns the head to the pre-gate state.
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
        if (/secur/iu.test(scope) || /\bsecurity\b/iu.test(c.subject)) {
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
        if (/honest[ -]null/iu.test(`${c.subject}\n${c.body}`)) {
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
 * rendered head inside its cap; SHA citations are capped at `DERIVED_SHA_CAP`
 * with an explicit remainder count rather than a silent truncation.
 */
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
        const shas = ev.map((h) => h.sha.slice(0, 7));
        const shown = shas.slice(0, DERIVED_SHA_CAP);
        const remainder = shas.length - shown.length;
        const more = remainder > 0 ? ` +${remainder} more` : '';
        out[label] = `${DERIVED_MARKER} ${reason} in ${shown.join(', ')}${more}.`;
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
