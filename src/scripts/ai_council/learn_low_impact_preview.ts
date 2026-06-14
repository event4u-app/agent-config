/**
 * Preview builder for `/memory learn-low-impact` (step-9 Phase 7).
 *
 * TypeScript twin of `src/scripts/ai_council/learn_low_impact_preview.py`
 * (ADR-094 — Python→TS migration, Phase 1).
 *
 * Default invocation is `--preview`: build a structured plan describing
 * which Validated entries would be upstreamed to the package seed without
 * opening a PR. `--apply` (handled by the agent, not this module) is the
 * explicit opt-in that triggers the actual upstream-contribute PR flow.
 *
 * The module is import-light by design — pure parsing + redaction + diff
 * rendering. PR creation lives in the `upstream-contribute` skill;
 * this module only hands the agent the material to surface.
 */

import * as fs from 'node:fs';

import { parse_corpus_strict } from './low_impact_corpus.js';
import {
    type RedactionViolation,
    redact_low_impact_entry,
} from './redact_low_impact_entry.js';

// Python: re.compile(r"^last-upstreamed:\s*([0-9a-f]{6,40}|0+)\s*$",
//                     re.IGNORECASE | re.MULTILINE)
// \s is Unicode in Python; emulate via the explicit Unicode whitespace class.
const _SP = '[ \\t\\f\\v\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0085]';
const _PROVENANCE_RE = new RegExp(
    `^last-upstreamed:${_SP}*([0-9a-f]{6,40}|0+)${_SP}*$`,
    'imu',
);

/** One Validated bullet that would be upstreamed. */
export interface PreviewEntry {
    readonly phrase: string;
    readonly normalised: string;
    readonly line_no: number;
}

/** A Validated bullet the redactor refused — never upstreams. */
export class RefusedEntry {
    readonly phrase: string;
    readonly line_no: number;
    readonly violations: readonly RedactionViolation[];

    constructor(phrase: string, line_no: number, violations: readonly RedactionViolation[]) {
        this.phrase = phrase;
        this.line_no = line_no;
        this.violations = violations;
    }

    reason(): string {
        // Python: "; ".join(f"{v.category}: {v.snippet}" for v in self.violations)
        return this.violations.map((v) => `${v.category}: ${v.snippet}`).join('; ');
    }
}

/**
 * Structured preview for `/memory learn-low-impact --preview`.
 *
 * Consumed by the agent which renders the human-facing preview block,
 * then waits for explicit `--apply` before invoking `upstream-contribute`.
 */
export class LearnLowImpactPreview {
    readonly promoted: readonly PreviewEntry[];
    readonly refused: readonly RefusedEntry[];
    readonly already_seeded: readonly string[];
    readonly last_upstreamed_sha: string;
    readonly seed_path: string;
    readonly corpus_path: string;
    readonly repo_slug: string;
    readonly warnings: readonly string[];

    constructor(opts: {
        promoted: readonly PreviewEntry[];
        refused: readonly RefusedEntry[];
        already_seeded: readonly string[];
        last_upstreamed_sha: string;
        seed_path: string;
        corpus_path: string;
        repo_slug?: string;
        warnings?: readonly string[];
    }) {
        this.promoted = opts.promoted;
        this.refused = opts.refused;
        this.already_seeded = opts.already_seeded;
        this.last_upstreamed_sha = opts.last_upstreamed_sha;
        this.seed_path = opts.seed_path;
        this.corpus_path = opts.corpus_path;
        this.repo_slug = opts.repo_slug ?? '';
        this.warnings = opts.warnings ?? [];
    }

    get has_work(): boolean {
        return this.promoted.length > 0 || this.refused.length > 0;
    }

    /**
     * True when `--apply` would actually open a PR.
     *
     * Iron Law: any redactor refusal blocks the PR — the author must
     * rephrase or drop the offending entry locally and re-run.
     */
    get would_open_pr(): boolean {
        return this.promoted.length > 0 && this.refused.length === 0;
    }

    /**
     * Human-readable preview block.
     *
     * Mirrors the rendering convention from `/memory mine-session`:
     * a leading title line, then bucketed entries.
     */
    render(): string {
        const lines: string[] = [];
        lines.push(
            '## learn-low-impact preview' +
                (this.repo_slug ? ` — repo=${this.repo_slug}` : ''),
        );
        lines.push(`last-upstreamed: ${this.last_upstreamed_sha}`);
        lines.push(`seed: ${this.seed_path}`);
        lines.push('');
        if (this.promoted.length > 0) {
            lines.push(`### Promoted (${this.promoted.length})`);
            for (const e of this.promoted) {
                lines.push(`- "${e.phrase}"  (line ${e.line_no})`);
            }
            lines.push('');
        }
        if (this.refused.length > 0) {
            lines.push(`### Refused (${this.refused.length}) — redactor blocked`);
            for (const r of this.refused) {
                lines.push(`- "${r.phrase}"  (line ${r.line_no}) — ${r.reason()}`);
            }
            lines.push('');
        }
        if (this.already_seeded.length > 0) {
            lines.push(`### Already seeded (${this.already_seeded.length})`);
            for (const phrase of this.already_seeded) {
                lines.push(`- "${phrase}"`);
            }
            lines.push('');
        }
        if (!this.has_work) {
            lines.push('> No new validated entries to upstream.');
            lines.push('');
        }
        if (this.refused.length > 0) {
            lines.push(
                '> Refusals block the PR. Rephrase the entries locally' +
                    ' (or drop them) and re-run.',
            );
        } else if (this.promoted.length > 0) {
            lines.push(
                '> Re-run with `--apply` to open the draft PR via' +
                    ' `upstream-contribute`.',
            );
        }
        // Python: "\n".join(lines).rstrip() + "\n"
        return _rstrip(lines.join('\n')) + '\n';
    }

    /**
     * Source-project-stripped diff that `--apply` would propose.
     *
     * Emits unified-diff-style `+` lines for each promoted phrase under the
     * seed file's `## Validated` section. The agent uses this as the
     * `upstream-contribute` patch body.
     */
    render_diff(): string {
        if (this.promoted.length === 0) {
            return '';
        }
        const lines = [`--- ${this.seed_path}`, `+++ ${this.seed_path}`];
        for (const e of this.promoted) {
            lines.push(`+- "${e.phrase}"`);
        }
        return lines.join('\n') + '\n';
    }

    /** Draft PR body for the upstream contribute flow. */
    render_pr_body(): string {
        const n = this.promoted.length;
        const slug = this.repo_slug || '<repo-slug>';
        const title = `feat(low-impact-seed): add ${n} validated entries from ${slug}`;
        const bodyLines: string[] = [
            `# ${title}`,
            '',
            'Upstream from `/memory learn-low-impact --apply`.',
            '',
            '## Entries',
            '',
        ];
        for (const e of this.promoted) {
            bodyLines.push(`- "${e.phrase}"`);
        }
        bodyLines.push('');
        bodyLines.push(`Provenance baseline: \`${this.last_upstreamed_sha}\`.`);
        bodyLines.push('');
        bodyLines.push(
            'Per `low-impact-corpus-privacy-floor`, every entry above' +
                ' cleared the redactor on intake and again at upstream.',
        );
        return bodyLines.join('\n') + '\n';
    }
}

/** Python `str.rstrip()`. */
function _rstrip(s: string): string {
    // Python str.rstrip() strips Unicode whitespace from the end. Use the
    // explicit Python str.isspace() set (ASCII + Unicode space separators +
    // line/para separators + NEL); JS \s under /u is close but Python also
    // treats a handful of separators as space.
    const WS =
        '\\t\\n\\v\\f\\r \\u001c\\u001d\\u001e\\u001f\\u0085\\u00a0' +
        '\\u1680\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007' +
        '\\u2008\\u2009\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
    const re = new RegExp(`[${WS}]+$`, 'u');
    return s.replace(re, '');
}

/**
 * Return the set of normalised phrases already in the seed file.
 *
 * Missing seed file is not an error — it returns an empty set so the
 * first-ever upstream PR can seed the whole corpus. Reuses the strict
 * parser so the seed itself is contract-validated.
 */
function _readSeedPhrases(seedPath: string): Set<string> {
    if (!fs.existsSync(seedPath)) {
        return new Set();
    }
    const result = parse_corpus_strict(seedPath);
    return new Set(result.validated.map((e) => e.normalised));
}

function _readProvenance(corpusPath: string): string {
    if (!fs.existsSync(corpusPath)) {
        return '0'.repeat(40);
    }
    const text = fs.readFileSync(corpusPath, { encoding: 'utf-8' });
    const m = _PROVENANCE_RE.exec(text);
    return m ? (m[1] as string).toLowerCase() : '0'.repeat(40);
}

export interface BuildPreviewOptions {
    repoRoot?: string | null;
    privateDomains?: Iterable<string>;
    customerNames?: Iterable<string>;
    sqlIdentifiers?: Iterable<string>;
    repoSlug?: string;
}

/**
 * Build the preview plan without performing any PR side-effects.
 *
 * Steps mirror the command doc:
 *
 * 1. Parse the local corpus (strict — drift surfaces as ParseError).
 *    Step-10: the preview deliberately stays on the Markdown parser
 *    (not the YAML lockfile) because it runs *before* `task sync`
 *    rebuilds the lockfile from a user's local corpus edits.
 * 2. Diff Validated entries against the upstream seed.
 * 3. Run the redactor on every candidate.
 * 4. Bucket into promoted / refused / already-seeded.
 */
export function build_preview(
    corpusPath: string,
    seedPath: string,
    opts: BuildPreviewOptions = {},
): LearnLowImpactPreview {
    const repoRoot = opts.repoRoot ?? null;
    const privateDomains = opts.privateDomains ?? [];
    const customerNames = opts.customerNames ?? [];
    const sqlIdentifiers = opts.sqlIdentifiers ?? [];
    const repoSlug = opts.repoSlug ?? '';

    const corpusP = String(corpusPath);
    const seedP = String(seedPath);
    const parsed = parse_corpus_strict(corpusP);
    const seeded = _readSeedPhrases(seedP);
    const promoted: PreviewEntry[] = [];
    const refused: RefusedEntry[] = [];
    const already: string[] = [];
    for (const entry of parsed.validated) {
        if (seeded.has(entry.normalised)) {
            already.push(entry.phrase);
            continue;
        }
        const result = redact_low_impact_entry(entry.phrase, {
            repoRoot,
            privateDomains,
            customerNames,
            sqlIdentifiers,
        });
        if (result.ok) {
            promoted.push({
                phrase: entry.phrase,
                normalised: entry.normalised,
                line_no: entry.line_no,
            });
        } else {
            refused.push(new RefusedEntry(entry.phrase, entry.line_no, result.violations));
        }
    }
    return new LearnLowImpactPreview({
        promoted,
        refused,
        already_seeded: already,
        last_upstreamed_sha: _readProvenance(corpusP),
        seed_path: seedP,
        corpus_path: corpusP,
        repo_slug: repoSlug,
        warnings: parsed.warnings,
    });
}
