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
 * prose, and a filled field is never judged for quality.
 *
 * The classifier lives in `_lib/release_highlights.ts` and is shared with the
 * generator, which now pre-fills each substantiated label instead of writing
 * `_none_` everywhere. That removes the guaranteed first-run red (9.17.0,
 * 9.18.0) without blunting this gate: a machine-written `_none_` was never the
 * failure it was built for — a HUMAN writing one was (9.13.0, 9.14.0), and that
 * still fails here. An unrewritten derived line warns; it never blocks.
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
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
    HEAD_LABELS,
    HEAD_NONE,
    type SpanCommit,
    collect_span_commits,
    derive_categories,
    parse_git_log,
    previous_release_tag,
    stale_draft_labels,
} from './_lib/release_highlights.js';
import { extract_changelog_section } from './_lib/release_material.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Labels and derivation live in `_lib/release_highlights.ts` — ONE definition
// shared with the generator that pre-fills the head. They used to be duplicated
// here to keep the checker independent of the release pipeline, and that
// independence is what produced the defect this gate now guards against from
// the other side: the generator wrote `_none_` into every field while this
// checker rejected exactly that, so every release PR was red on its first run.
// Sharing the classifier does not blunt the gate — it still blocks the failure
// it was built for, a human editing a substantiated line back to `_none_`.
export {
    HEAD_LABELS,
    HEAD_NONE,
    derive_categories,
    parse_git_log as _parse_git_log,
    type SpanCommit,
};

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
        from = previous_release_tag(to, REPO_ROOT);
        if (!from) {
            process.stderr.write(
                `no release tag reachable before ${to} — pass --from explicitly\n`,
            );
            return 2;
        }
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
    let span: SpanCommit[];
    try {
        span = collect_span_commits(from, to, REPO_ROOT);
    } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
    }
    // A generator-derived line that nobody rewrote is a prose gap, never a
    // contradiction: the line's evidence is true, it is just unpolished. Warn
    // so the omission is visible, and keep the exit code owned solely by the
    // `_none_` check — a warning that reds the build is the guaranteed-red
    // failure mode this whole change exists to remove.
    const drafts = stale_draft_labels(curated);
    if (drafts.length > 0) {
        process.stdout.write(
            `⚠️  auto-derived head line(s) not yet rewritten for ${version}: ` +
                `${drafts.join(', ')} — advisory, not blocking.\n`,
        );
    }
    const derived = derive_categories(span);
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
