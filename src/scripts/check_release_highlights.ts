/**
 * Highlight plausibility gate (release-truth Phase 2).
 *
 * The recorded failure: the curated release head said `_none_` twice while
 * false — 9.13.0 shipped behaviour changes, a removed public trigger type, a
 * security fix, and honest nulls; the head claimed none of it. Same at
 * 9.14.0.
 *
 * This gate derives GENERATED evidence categories from the release span
 * (security-tagged commits, behaviour/default changes from conventional
 * commit types + rule/schema diffs, honest-null markers, removed public
 * surface) and FAILS when a populated generated category meets a `_none_`
 * curated field. It blocks the contradiction only — a human still writes the
 * prose; nothing here auto-formulates highlights, and a filled field is
 * never judged for quality.
 *
 * Derivation is deliberately conservative (documented per-label below):
 * a false red makes every release annoying; a miss only returns the head to
 * the pre-gate state. Adjudication of derived evidence stays human.
 *
 * Usage:
 *   check_release_highlights --version X.Y.Z [--from <ref>] [--to <ref>]
 *       [--changelog <path>]
 *
 * `--from` defaults to the latest reachable release tag before `--to`
 * (default HEAD). Exit codes: 0 plausible · 1 contradiction · 2 usage error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { extract_changelog_section } from './_lib/release_material.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// The five curated labels, mirrored from release.ts RELEASE_HEAD_SECTIONS
// (kept literal here so this checker has no import edge into the release
// pipeline it audits; the unit tests pin the two lists against each other).
export const HEAD_LABELS: readonly string[] = [
    'Behaviour changes',
    'Default changes + migration',
    'Security and correctness',
    'Honest nulls',
    'Known limitations',
];

export const HEAD_NONE = '_none_';

export interface SpanCommit {
    sha: string;
    subject: string;
    body: string;
    /** `A` / `M` / `D` / `R…` status per touched path. */
    files: ReadonlyArray<{ status: string; path: string }>;
    breaking: boolean;
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
 */
export function derive_categories(commits: readonly SpanCommit[]): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const label of HEAD_LABELS) {
        out[label] = [];
    }
    const evidence = (c: SpanCommit): string => `${c.sha.slice(0, 7)} ${c.subject}`;
    for (const c of commits) {
        const scopeMatch = /^\w+\(([^)]*)\)!?:/u.exec(c.subject);
        const scope = scopeMatch ? scopeMatch[1]! : '';
        if (/secur/iu.test(scope) || /\bsecurity\b/iu.test(c.subject)) {
            out['Security and correctness']!.push(evidence(c));
        }
        const removedPublic = c.files.filter(
            (f) => f.status.startsWith('D') && _PUBLIC_SURFACE_PREFIXES.some((p) => f.path.startsWith(p)),
        );
        const ruleOrSchema = c.files.some((f) =>
            _RULE_OR_SCHEMA_PREFIXES.some((p) => f.path.startsWith(p)),
        );
        if (c.breaking || ruleOrSchema || removedPublic.length > 0) {
            const detail =
                removedPublic.length > 0
                    ? `${evidence(c)} (removes ${removedPublic.map((f) => f.path).join(', ')})`
                    : evidence(c);
            out['Behaviour changes']!.push(detail);
        }
        if (/\b(default|migration|migrate)\b/iu.test(c.subject)) {
            out['Default changes + migration']!.push(evidence(c));
        }
        if (/honest[ -]null/iu.test(`${c.subject}\n${c.body}`)) {
            out['Honest nulls']!.push(evidence(c));
        }
    }
    return out;
}

/**
 * Parse the curated head from a changelog section body. Returns null when
 * the section carries no `### Release highlights` head (pre-9.9.0 entries).
 */
export function parse_curated_head(sectionBody: string): Record<string, string> | null {
    if (!sectionBody.includes('### Release highlights')) {
        return null;
    }
    const out: Record<string, string> = {};
    for (const label of HEAD_LABELS) {
        const re = new RegExp(
            `^-\\s+\\*\\*${label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}:\\*\\*\\s*(.*)$`,
            'm',
        );
        const m = re.exec(sectionBody);
        if (m) {
            out[label] = m[1]!.trim();
        }
    }
    return Object.keys(out).length > 0 ? out : null;
}

export interface Contradiction {
    label: string;
    evidence: string[];
}

/**
 * A populated generated category meeting a `_none_` curated field is a
 * contradiction. Filled fields and underived labels never fail.
 */
export function highlight_contradictions(
    curated: Readonly<Record<string, string>>,
    derived: Readonly<Record<string, readonly string[]>>,
): Contradiction[] {
    const out: Contradiction[] = [];
    for (const label of HEAD_LABELS) {
        const curatedValue = (curated[label] ?? '').trim();
        const ev = derived[label] ?? [];
        if (curatedValue === HEAD_NONE && ev.length > 0) {
            out.push({ label, evidence: [...ev] });
        }
    }
    return out;
}

// ─── git span collection (CLI only — the core above is pure) ────────────────

const _RECORD = '\u001e';
const _FIELD = '\u001f';

export function _parse_git_log(raw: string): SpanCommit[] {
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

function _git(args: string[]): string {
    const r = spawnSync('git', args, { encoding: 'utf-8', cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) {
        process.stderr.write(`git ${args.join(' ')} failed: ${r.stderr}\n`);
        process.exit(2);
    }
    return r.stdout;
}

function _collect_span(from: string, to: string): SpanCommit[] {
    const raw = _git([
        'log',
        `${from}..${to}`,
        '--no-merges',
        '--name-status',
        '--format=%x1e%H%x1f%s%x1f%b',
    ]);
    return _parse_git_log(raw);
}

function main(argv: readonly string[]): number {
    let version: string | null = null;
    let from: string | null = null;
    let to = 'HEAD';
    let changelogPath = path.join(REPO_ROOT, 'CHANGELOG.md');
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--version') version = argv[++i] ?? null;
        else if (a === '--from') from = argv[++i] ?? null;
        else if (a === '--to') to = argv[++i] ?? to;
        else if (a === '--changelog') changelogPath = argv[++i] ?? changelogPath;
        else {
            process.stderr.write(`unknown argument: ${a}\n`);
            return 2;
        }
    }
    if (!version) {
        process.stderr.write('--version X.Y.Z is required\n');
        return 2;
    }
    if (!from) {
        from = _git(['describe', '--tags', '--abbrev=0', '--match', '[0-9]*.[0-9]*.[0-9]*', `${to}^`]).trim();
    }
    const section = extract_changelog_section(fs.readFileSync(changelogPath, 'utf-8'), version);
    if (!section) {
        process.stderr.write(`CHANGELOG carries no section for ${version}\n`);
        return 2;
    }
    const curated = parse_curated_head(section.body);
    if (!curated) {
        process.stdout.write(`ℹ️  no curated head in the ${version} section — nothing to check\n`);
        return 0;
    }
    const derived = derive_categories(_collect_span(from, to));
    const contradictions = highlight_contradictions(curated, derived);
    if (contradictions.length === 0) {
        process.stdout.write(`✅  curated head plausible for ${version} (span ${from}..${to})\n`);
        return 0;
    }
    process.stderr.write(
        `❌  curated head contradicts the release span for ${version} (${from}..${to}):\n`,
    );
    for (const c of contradictions) {
        process.stderr.write(`    - **${c.label}:** is \`_none_\` but the span carries:\n`);
        for (const e of c.evidence) {
            process.stderr.write(`        ${e}\n`);
        }
    }
    process.stderr.write(
        '    Fill the curated head in CHANGELOG.md (a human writes the prose) or adjudicate ' +
            'the evidence in the PR — the gate only blocks the `_none_` contradiction.\n',
    );
    return 1;
}

const _isMain = (() => {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return fs.realpathSync(entry) === fs.realpathSync(_HERE);
    } catch {
        return false;
    }
})();

if (_isMain) {
    process.exit(main(process.argv.slice(2)));
}
