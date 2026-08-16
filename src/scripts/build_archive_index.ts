#!/usr/bin/env tsx
/**
 * Build a machine-readable index over the roadmap archive.
 *
 * "Has this already been tried, closed, or refuted?" is answered today by
 * walking `agents/roadmaps/archive/` — 500 top-level files. This emits
 * `INDEX.md` (human) and `index.json` (machine) beside them so the question
 * costs one read instead of a walk.
 *
 * ## What is and is not extracted
 *
 * Every field is derived by a deterministic rule from the file's own bytes.
 * There are NO model-written summaries: a verdict the frontmatter does not
 * carry is emitted as `null` in JSON and `not extractable` in the table, so a
 * reader can tell a missing verdict from an invented one. That is the
 * roadmap's non-goal, enforced here rather than promised.
 *
 * `disposition` is the one derived field, and it is derived from the checkbox
 * tally alone — including acceptance-criteria boxes, which are checkboxes in
 * the same file and are not distinguished. It records how the file LOOKS at
 * archival, never why it was archived:
 *
 * | tally | disposition |
 * |---|---|
 * | no checkbox anywhere | `not-extractable` |
 * | any `[ ]` | `archived-with-open-steps` |
 * | any `[-]`, none open | `closed-with-cancellations` |
 * | any `[~]`, none open/cancelled | `completed-with-deferrals` |
 * | otherwise | `completed` |
 *
 * ## Drift
 *
 * `--check` regenerates in memory and compares byte-for-byte against the two
 * committed artefacts, following the shape `compile_router --check` already
 * uses. A generated artefact nobody re-derives goes stale in one merge.
 *
 * The output carries no timestamp on purpose — a clock in a generated file
 * makes every `--check` run a false red. The generation time lives in git
 * history, the same convention `agents/roadmaps-progress.md` states.
 *
 * Reuses `validate_frontmatter`'s reader; this file adds no second parser.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { parse_frontmatter } from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const ARCHIVE_REL = 'agents/roadmaps/archive';
const INDEX_MD = 'INDEX.md';
const INDEX_JSON = 'index.json';

/** The generated artefacts themselves are never indexed. */
const SELF: ReadonlySet<string> = new Set([INDEX_MD, INDEX_JSON]);

/** `- [ ]` / `* [x]` / `- [~]` / `- [-]`, the four glyphs the roadmaps use. */
const CHECKBOX_RE = /^[ \t]*[-*][ \t]+\[([ xX~-])\][ \t]/;

/** `## Phase 3 — …` or `### Phase 0: …`. Two heading levels are in use. */
const PHASE_RE = /^#{2,3}[ \t]+Phase\b/;

/** The first level-1 heading, used as the title when frontmatter has none. */
const H1_RE = /^#[ \t]+(.+?)[ \t]*$/;

export type Disposition =
    | 'completed'
    | 'completed-with-deferrals'
    | 'closed-with-cancellations'
    | 'archived-with-open-steps'
    | 'not-extractable';

export interface StepTally {
    open: number;
    done: number;
    deferred: number;
    cancelled: number;
}

export interface ArchiveEntry {
    slug: string;
    title: string | null;
    disposition: Disposition;
    phases: number;
    steps: StepTally;
    /** Frontmatter `verdict:`, verbatim. `null` = the file carries none. */
    verdict: string | null;
    /** Frontmatter `status:`, verbatim. Authoring status, not a closure. */
    status: string | null;
}

/** Frontmatter value → string, or `null` for absent / non-scalar. */
function _scalar(value: unknown): string | null {
    if (typeof value === 'string') {
        const t = value.trim();
        return t === '' ? null : t;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return null;
}

/**
 * Frontmatter, or `{}` when the file has none or carries a malformed block.
 *
 * A 500-file corpus assembled over months contains frontmatter the strict
 * subset parser rejects; that is a property of the archive, not an error in
 * this pass. Such a file still gets an entry — with its frontmatter-derived
 * fields absent, which is exactly what "not extractable" means.
 */
function _frontmatter(text: string): Record<string, unknown> {
    try {
        const [data] = parse_frontmatter(text);
        return data ?? {};
    } catch {
        return {};
    }
}

/** Body lines, i.e. everything after a frontmatter block if one is present. */
function _bodyLines(text: string): string[] {
    const lines = text.split('\n');
    if (lines[0]?.trimEnd() !== '---') {
        return lines;
    }
    for (let i = 1; i < lines.length; i += 1) {
        if (lines[i]?.trimEnd() === '---') {
            return lines.slice(i + 1);
        }
    }
    return lines;
}

export function tally(bodyLines: readonly string[]): StepTally {
    const t: StepTally = { open: 0, done: 0, deferred: 0, cancelled: 0 };
    for (const line of bodyLines) {
        const m = CHECKBOX_RE.exec(line);
        if (m === null) {
            continue;
        }
        switch (m[1]) {
            case ' ':
                t.open += 1;
                break;
            case '~':
                t.deferred += 1;
                break;
            case '-':
                t.cancelled += 1;
                break;
            default:
                t.done += 1;
        }
    }
    return t;
}

export function disposition(t: StepTally): Disposition {
    if (t.open + t.done + t.deferred + t.cancelled === 0) {
        return 'not-extractable';
    }
    if (t.open > 0) {
        return 'archived-with-open-steps';
    }
    if (t.cancelled > 0) {
        return 'closed-with-cancellations';
    }
    if (t.deferred > 0) {
        return 'completed-with-deferrals';
    }
    return 'completed';
}

export function buildEntry(slug: string, text: string): ArchiveEntry {
    const fm = _frontmatter(text);
    const body = _bodyLines(text);

    let title = _scalar(fm['title']);
    if (title === null) {
        for (const line of body) {
            const m = H1_RE.exec(line);
            if (m !== null) {
                title = (m[1] ?? '').trim() || null;
                break;
            }
        }
    }

    const steps = tally(body);
    return {
        slug,
        title,
        disposition: disposition(steps),
        phases: body.filter((l) => PHASE_RE.test(l)).length,
        steps,
        verdict: _scalar(fm['verdict']),
        status: _scalar(fm['status']),
    };
}

/** Top-level `*.md` under the archive, sorted, excluding the generated pair. */
export function archiveFiles(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => !e.isDirectory() && e.name.endsWith('.md') && !SELF.has(e.name))
        .map((e) => e.name)
        .sort();
}

export function buildIndex(dir: string): ArchiveEntry[] {
    return archiveFiles(dir).map((name) =>
        buildEntry(name.replace(/\.md$/, ''), fs.readFileSync(path.join(dir, name), 'utf8')),
    );
}

/** Table-cell text: pipes escaped, newlines flattened, never empty. */
function _cell(value: string | null): string {
    if (value === null) {
        return '_not extractable_';
    }
    return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

export function renderJson(entries: readonly ArchiveEntry[]): string {
    return (
        JSON.stringify(
            {
                generated_by: 'src/scripts/build_archive_index.ts',
                source: ARCHIVE_REL,
                count: entries.length,
                entries,
            },
            null,
            2,
        ) + '\n'
    );
}

export function renderMarkdown(entries: readonly ArchiveEntry[]): string {
    const byDisposition = new Map<Disposition, number>();
    for (const e of entries) {
        byDisposition.set(e.disposition, (byDisposition.get(e.disposition) ?? 0) + 1);
    }
    const summary = [...byDisposition.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([d, n]) => `${d} ${String(n)}`)
        .join(' · ');

    const out: string[] = [
        '# Archive index',
        '',
        '> Auto-generated — do not edit. Regenerate with `task build-archive-index`;',
        '> `task check-archive-index` fails on drift. Generation time lives in git',
        '> history, not in this file (a clock here would make every drift check a',
        '> false red).',
        '',
        `**${String(entries.length)} archived roadmaps** · ${summary}`,
        '',
        'Every column is extracted deterministically from the file itself. No',
        'summary here is model-written: a verdict the frontmatter does not carry',
        'reads _not extractable_ rather than being inferred. `Disposition` is',
        'derived from the checkbox tally alone (acceptance-criteria boxes',
        'included) and records how the file looks, never why it was archived —',
        'so for anything the index marks _not extractable_, open the file.',
        '',
        '**Limits worth knowing before you rely on this.** Only a handful of',
        'archived roadmaps carry a frontmatter `verdict:`, so the index answers',
        '_tried?_ and _closed?_ and sends you to the file for _why_. The measured',
        'saving is 82 % fewer files opened on a pre-registered question set — and',
        'below roughly five candidate files it is a wash, so a single narrow',
        'question is cheaper answered directly. Reading, method and full',
        'distribution: [`archive-index-saving`](../../evidence/analysis/archive-index-saving.md).',
        '',
        '| Roadmap | Title | Disposition | Phases | Steps (done/total) | Verdict |',
        '|---|---|---|---:|---|---|',
    ];

    for (const e of entries) {
        const total = e.steps.open + e.steps.done + e.steps.deferred + e.steps.cancelled;
        const steps = total === 0 ? '—' : `${String(e.steps.done)}/${String(total)}`;
        out.push(
            `| [\`${e.slug}\`](${e.slug}.md) | ${_cell(e.title)} | ${e.disposition} | ` +
                `${String(e.phases)} | ${steps} | ${_cell(e.verdict)} |`,
        );
    }
    out.push('');
    return out.join('\n');
}

function _read(p: string): string | null {
    try {
        return fs.readFileSync(p, 'utf8');
    } catch {
        return null;
    }
}

export function main(argv: readonly string[]): number {
    const quiet = argv.includes('--quiet');
    const dir = path.join(ROOT, ARCHIVE_REL);

    const entries = buildIndex(dir);
    try {
        reportScanned({
            gate: 'build_archive_index',
            scanned: entries.length,
            units: 'archived roadmap(s)',
            roots: [ARCHIVE_REL],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`${err.message}\n`);
            return 1;
        }
        throw err;
    }

    const mdPath = path.join(dir, INDEX_MD);
    const jsonPath = path.join(dir, INDEX_JSON);
    const md = renderMarkdown(entries);
    const json = renderJson(entries);

    if (argv.includes('--check')) {
        const stale = [
            _read(mdPath) === md ? null : `${ARCHIVE_REL}/${INDEX_MD}`,
            _read(jsonPath) === json ? null : `${ARCHIVE_REL}/${INDEX_JSON}`,
        ].filter((v): v is string => v !== null);
        if (stale.length > 0) {
            process.stderr.write(
                `❌  archive index out of date (${stale.join(', ')}) — run \`task build-archive-index\`\n`,
            );
            return 1;
        }
        if (!quiet) {
            process.stdout.write('✅  archive index is up to date\n');
        }
        return 0;
    }

    fs.writeFileSync(mdPath, md, 'utf8');
    fs.writeFileSync(jsonPath, json, 'utf8');
    if (!quiet) {
        process.stdout.write(
            `✅  archive index — ${String(entries.length)} roadmap(s) → ` +
                `${ARCHIVE_REL}/{${INDEX_MD},${INDEX_JSON}}\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (an installed projection, or macOS /var →
    // /private/var temp dirs) makes the raw URLs differ: import.meta.url is
    // the resolved real path while argv[1] keeps the symlink path.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
