#!/usr/bin/env tsx
/**
 * The invocation-surface census — what a host or an MCP client is told about
 * how to invoke an artifact, counted by a unit defined before it is counted.
 *
 * road-to-an-invocation-contract-that-reaches-the-wire 1.1. Report only: it
 * exits 0 on every corpus, carries the `report_` prefix so the gate population
 * classifies it out, and asserts no threshold.
 *
 * THE UNIT, AND WHY THE SOURCE FIGURES DO NOT REPRODUCE
 *
 * The roadmap's Goal states 11 skills using `${...}`, 4 using `<UPPERCASE>` and
 * 2 using `{{...}}`. NONE of the three reproduces, and the reason is the same
 * one every time: a natural grep counts matches inside CODE, where the token
 * belongs to the language being demonstrated rather than to this package.
 *
 *   - `${viewport.name}` in `playwright-testing` is a JavaScript template
 *     literal in an example.
 *   - `${local.env.aws_account_id}` and `${get_env(...)}` in `terragrunt` are
 *     HCL interpolation in example configuration.
 *   - `${user.id}` in `testing-anti-patterns` is another JS template literal.
 *   - `` `<TBD>` `` in `livewire-architect` is a table-cell marker the prose is
 *     TALKING ABOUT — "the component shape table is filled in (no `<TBD>`
 *     cells)" — not a slot anything substitutes.
 *
 * A census that counts those is not measuring invocation syntax; it is
 * measuring how many skills teach a templating language. So the unit here is:
 *
 *   **one occurrence of a placeholder token in PROSE** — outside fenced code
 *   blocks, outside indented code blocks, and outside inline code spans.
 *
 * That is the opposite of the choice `ask_block_census` makes for its own
 * subject, deliberately: there the fenced block IS the rendered hand-back being
 * counted, so stripping fences would blind it. Here a fence is foreign
 * territory, and NOT stripping it is what produced a figure four times the real
 * one. Both scripts publish the reasoning above the number for the same reason.
 *
 * NO NUMBER IS CARRIED FORWARD from the roadmap. The figures below are this
 * script's own, under the definition above, and the per-file breakdown is
 * printed so a reader can disagree with the definition rather than having to
 * trust it.
 *
 * WHAT ELSE IS COUNTED
 *
 * Per artifact: whether it declares an `inputs:` frontmatter block (the
 * structured declaration Phase 2 introduces — zero today, by construction), and
 * whether it carries an `argument-hint`. The hint coverage is the figure Phase
 * 3 closes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Projected commands — what a host actually installs. */
const COMMANDS_REL = path.join('dist', 'agent-src', 'commands');

/** Skill sources. */
const SKILLS_REL = path.join('src', 'skills');

const DEFAULT_OUT = path.join('agents', 'evidence', 'analysis', 'invocation-surface-census.md');

/**
 * The placeholder syntaxes tracked, and which one this package treats as its
 * own.
 *
 * `canonical` is descriptive, not a ruling: it records which form the corpus
 * uses in prose today. Nothing here rewrites a body, and the drift ratchet that
 * consumes this census fails on GROWTH of the foreign forms only — never on the
 * absolute number and never on the plurality form.
 */
export const SYNTAXES = [
    { id: 'dollar-brace', label: '${…}', re: /\$\{[^}\s][^}]*\}/g, canonical: true },
    { id: 'angle-upper', label: '<UPPER>', re: /<[A-Z][A-Z_]+>/g, canonical: false },
    { id: 'double-brace', label: '{{…}}', re: /\{\{[^}\n]+\}\}/g, canonical: false },
] as const;

export type SyntaxId = (typeof SYNTAXES)[number]['id'];

/**
 * Remove every region where a placeholder token belongs to demonstrated code
 * rather than to this package's own invocation surface.
 *
 * Order matters: fenced blocks first (they may contain indented lines and
 * backticks), then indented blocks, then inline spans.
 */
export function proseOnly(text: string): string {
    const withoutFences = text.replace(/^([ \t]*)(```|~~~)[\s\S]*?^\1?\2[^\n]*$/gm, '');
    const withoutIndented = withoutFences
        .split('\n')
        .map((line) => (/^(?: {4}|\t)/.test(line) ? '' : line))
        .join('\n');
    return withoutIndented.replace(/`[^`\n]*`/g, '');
}

export interface ArtifactRow {
    /** Repo-relative path. */
    readonly file: string;
    /** `command` or `skill`. */
    readonly kind: 'command' | 'skill';
    /** Does the frontmatter carry a structured `inputs:` block? */
    readonly declaresInputs: boolean;
    /** Does the frontmatter carry an `argument-hint`? */
    readonly hasHint: boolean;
    /** Prose placeholder occurrences, per syntax. Absent syntaxes are omitted. */
    readonly placeholders: Readonly<Partial<Record<SyntaxId, number>>>;
}

export interface Census {
    readonly rows: readonly ArtifactRow[];
    readonly commands: number;
    readonly skills: number;
    /** Commands carrying an `argument-hint`. */
    readonly commandsWithHint: number;
    /** Artifacts declaring `inputs:`. */
    readonly declaring: number;
    /** Prose occurrences per syntax, whole corpus. */
    readonly occurrences: Readonly<Record<SyntaxId, number>>;
    /** Files carrying at least one occurrence, per syntax. */
    readonly files: Readonly<Record<SyntaxId, number>>;
}

function frontmatter(text: string): string {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    return m === null ? '' : m[1]!;
}

function walk(dir: string, match: (name: string) => boolean, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, match, out);
        else if (match(e.name)) out.push(p);
    }
    return out;
}

export function census(root: string): Census {
    const files: { file: string; kind: 'command' | 'skill' }[] = [
        ...walk(path.join(root, COMMANDS_REL), (n) => n.endsWith('.md')).map((f) => ({
            file: f,
            kind: 'command' as const,
        })),
        ...walk(path.join(root, SKILLS_REL), (n) => n === 'SKILL.md').map((f) => ({
            file: f,
            kind: 'skill' as const,
        })),
    ].sort((a, b) => a.file.localeCompare(b.file));

    const occurrences: Record<string, number> = {};
    const fileCounts: Record<string, number> = {};
    for (const s of SYNTAXES) {
        occurrences[s.id] = 0;
        fileCounts[s.id] = 0;
    }

    const rows: ArtifactRow[] = [];
    for (const { file, kind } of files) {
        const text = fs.readFileSync(file, 'utf8');
        const fm = frontmatter(text);
        const prose = proseOnly(text);

        const placeholders: Partial<Record<SyntaxId, number>> = {};
        for (const s of SYNTAXES) {
            const n = (prose.match(s.re) ?? []).length;
            if (n === 0) continue;
            placeholders[s.id] = n;
            occurrences[s.id] = (occurrences[s.id] ?? 0) + n;
            fileCounts[s.id] = (fileCounts[s.id] ?? 0) + 1;
        }

        rows.push({
            file: path.relative(root, file),
            kind,
            declaresInputs: /^inputs:/m.test(fm),
            hasHint: /^argument-hint:/m.test(fm),
            placeholders,
        });
    }

    return {
        rows,
        commands: rows.filter((r) => r.kind === 'command').length,
        skills: rows.filter((r) => r.kind === 'skill').length,
        commandsWithHint: rows.filter((r) => r.kind === 'command' && r.hasHint).length,
        declaring: rows.filter((r) => r.declaresInputs).length,
        occurrences: occurrences as Record<SyntaxId, number>,
        files: fileCounts as Record<SyntaxId, number>,
    };
}

function pin(root: string): { sha: string; date: string } {
    const git = (args: string[]): string =>
        execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    try {
        return {
            sha: git(['rev-parse', 'HEAD']),
            date: git(['show', '-s', '--format=%cI', 'HEAD']),
        };
    } catch {
        return { sha: 'unknown', date: 'unknown' };
    }
}

export function render(c: Census, p: { sha: string; date: string }): string {
    const L: string[] = [];
    L.push('<!-- evidence-type: analysis -->');
    L.push(`<!-- invocation-surface-census: v1 | commit: ${p.sha} | commit-date: ${p.date} -->`);
    L.push('');
    L.push('# Invocation-surface census');
    L.push('');
    L.push(
        'Emitted by `src/scripts/report_invocation_surface.ts`. **Read that script’s module',
    );
    L.push(
        'header before reading a number here** — it defines the counting unit, and the unit is',
    );
    L.push('the whole disagreement with the figures this roadmap started from.');
    L.push('');
    L.push(
        '**A placeholder occurrence is a token in PROSE** — outside fenced code blocks, indented',
    );
    L.push(
        'code blocks and inline code spans. A skill teaching Terraform contains `${local.x}`; a',
    );
    L.push(
        'skill teaching Playwright contains `${viewport.name}`. Counting those measures how many',
    );
    L.push('skills teach a templating language, not how this package declares invocation.');
    L.push('');
    L.push(`- **Commit pin:** \`${p.sha}\` (${p.date})`);
    L.push(`- **Corpus:** \`${COMMANDS_REL}/**/*.md\` — ${String(c.commands)} command(s); \`${SKILLS_REL}/*/SKILL.md\` — ${String(c.skills)} skill(s)`);
    L.push('');

    L.push('## Declaration coverage');
    L.push('');
    L.push(
        `- Artifacts declaring a structured \`inputs:\` block: **${String(c.declaring)}** of ${String(c.rows.length)}.`,
    );
    L.push(
        `- Commands carrying an \`argument-hint\`: **${String(c.commandsWithHint)}** of ${String(c.commands)} — ${String(c.commands - c.commandsWithHint)} carry none.`,
    );
    L.push('');

    L.push('## Prose placeholder occurrences');
    L.push('');
    L.push('| syntax | role | occurrences | files |');
    L.push('|---|---|---|---|');
    for (const s of SYNTAXES) {
        L.push(
            `| \`${s.label}\` | ${s.canonical ? 'plurality form' : 'foreign'} | ${String(c.occurrences[s.id])} | ${String(c.files[s.id])} |`,
        );
    }
    L.push('');

    const carrying = c.rows.filter((r) => Object.keys(r.placeholders).length > 0);
    if (carrying.length === 0) {
        L.push('No artifact carries a placeholder token in prose.');
    } else {
        L.push('### Which files, and what they actually contain');
        L.push('');
        L.push('| file | syntax | n |');
        L.push('|---|---|---|');
        for (const r of carrying) {
            for (const s of SYNTAXES) {
                const n = r.placeholders[s.id];
                if (n === undefined) continue;
                L.push(`| \`${r.file}\` | \`${s.label}\` | ${String(n)} |`);
            }
        }
    }
    L.push('');
    return L.join('\n');
}

export function main(argv: readonly string[]): number {
    const write = argv.includes('--write');
    const json = argv.includes('--json');
    const outIdx = argv.indexOf('--out');
    const out = outIdx >= 0 ? argv[outIdx + 1] : undefined;

    const c = census(REPO_ROOT);

    if (json) {
        process.stdout.write(`${JSON.stringify(c, null, 2)}\n`);
        return 0;
    }
    if (write) {
        const target = path.resolve(REPO_ROOT, out ?? DEFAULT_OUT);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, render(c, pin(REPO_ROOT)), 'utf8');
        process.stdout.write(
            `report_invocation_surface: wrote ${path.relative(REPO_ROOT, target)}\n`,
        );
        return 0;
    }

    process.stdout.write(
        `report_invocation_surface · ${String(c.commands)} command(s), ${String(c.skills)} skill(s)\n`,
    );
    process.stdout.write(
        `  argument-hint: ${String(c.commandsWithHint)}/${String(c.commands)} command(s) · inputs: ${String(c.declaring)} artifact(s)\n`,
    );
    for (const s of SYNTAXES) {
        process.stdout.write(
            `  ${s.label.padEnd(9)} ${s.canonical ? 'plurality' : 'foreign  '} occ=${String(c.occurrences[s.id])} files=${String(c.files[s.id])}\n`,
        );
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
