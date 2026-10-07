#!/usr/bin/env tsx
/**
 * Census of open blockers in parked roadmaps — measures, never gates.
 *
 * `lint_roadmap_blockers` and `/roadmap:resolve-blockers` both exclude
 * the parked directory (`later/`) by a recorded decision ("history rather than
 * debt"). This report reads exactly that directory so the decision can be
 * revisited on a number rather than a guess: every `### blocker:` entry whose
 * `Status:` is not `resolved`, with its file, its raw `Owner:` value and
 * whether that owner is the owner (maintainer / user / owner — the same set
 * `lint_roadmap_blockers` treats as a user decision) or a condition an agent
 * can reach. Separately it lists every blockquote that names an owner
 * question or owner decision, because such a question is invisible to any
 * blocker reader even when its directory is in scope.
 *
 * The raw `Owner:` value is printed beside its classification: the field is
 * free text, and a misread must be visible to whoever reads the report.
 *
 * Usage:
 *   ./scripts-run src/scripts/report_parked_blockers
 *   ./scripts-run src/scripts/report_parked_blockers --format json
 *   ./scripts-run src/scripts/report_parked_blockers --dir <path>
 *
 * Exit codes: 0 report emitted · 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { REPO_ROOT, _stripFencedCode } from './lint_roadmap_blockers.js';

type OwnerWait = 'owner' | 'agent';

interface ParkedBlocker {
    file: string;
    id: string;
    status: string;
    owner: string;
    wait: OwnerWait;
}

interface OwnerQuestion {
    file: string;
    line: number;
    text: string;
    blocker_entries_in_file: number;
}

interface Census {
    dir: string;
    files_scanned: number;
    files_with_open_blockers: number;
    blockers: ParkedBlocker[];
    owner_questions: OwnerQuestion[];
}

const BLOCKERS_SECTION_RE = /^##[ \t]+Blockers[ \t]*$/im;
const NEXT_H2_RE = /^##[ \t]+\S/m;
const BLOCKER_HEADING_RE = /^###[ \t]+blocker:[ \t]*(.+?)[ \t]*$/gim;
const STATUS_RE = /^-[ \t]*\*\*Status:\*\*[ \t]*(.*)$/im;
const OWNER_RE = /^-[ \t]*\*\*Owner:\*\*[ \t]*(.*)$/im;
const OWNER_WAIT_RE = /^(maintainer|user|owner)\b/i;
const OWNER_QUESTION_RE = /owner[ \t]+(question|decision)/i;

function _classifyOwner(raw: string): OwnerWait {
    return OWNER_WAIT_RE.test(raw.trim()) ? 'owner' : 'agent';
}

/** Every blocker entry in one file's `## Blockers` section, open or not. */
function _blockerEntries(text: string): Array<{ id: string; status: string; owner: string }> {
    const stripped = _stripFencedCode(text);
    const sectionMatch = BLOCKERS_SECTION_RE.exec(stripped);
    if (!sectionMatch) {
        return [];
    }
    const start = sectionMatch.index + sectionMatch[0].length;
    const rest = stripped.slice(start);
    const h2 = NEXT_H2_RE.exec(rest);
    const section = h2 ? rest.slice(0, h2.index) : rest;

    const heads: Array<{ start: number; end: number; id: string }> = [];
    BLOCKER_HEADING_RE.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = BLOCKER_HEADING_RE.exec(section)) !== null) {
        heads.push({ start: hm.index, end: hm.index + hm[0].length, id: (hm[1] as string).trim() });
        if (hm.index === BLOCKER_HEADING_RE.lastIndex) {
            BLOCKER_HEADING_RE.lastIndex++;
        }
    }
    return heads.map((cur, i) => {
        const next = heads[i + 1];
        const body = section.slice(cur.end, next ? next.start : section.length);
        return {
            id: cur.id,
            status: (STATUS_RE.exec(body)?.[1] ?? '').trim(),
            owner: (OWNER_RE.exec(body)?.[1] ?? '').trim(),
        };
    });
}

/** Blockquote lines that name an owner question or owner decision. */
function _ownerQuestionLines(text: string): Array<{ line: number; text: string }> {
    const out: Array<{ line: number; text: string }> = [];
    let inFence = false;
    text.split('\n').forEach((raw, i) => {
        if (/^[ \t]*```/.test(raw)) {
            inFence = !inFence;
            return;
        }
        if (!inFence && /^[ \t]*>/.test(raw) && OWNER_QUESTION_RE.test(raw)) {
            out.push({ line: i + 1, text: raw.trim() });
        }
    });
    return out;
}

function collect(dir: string, root: string = REPO_ROOT): Census {
    const files = fs.existsSync(dir)
        ? fs
              .readdirSync(dir, { withFileTypes: true })
              .filter((e) => e.isFile() && e.name.endsWith('.md'))
              .map((e) => path.join(dir, e.name))
              .sort()
        : [];
    const blockers: ParkedBlocker[] = [];
    const ownerQuestions: OwnerQuestion[] = [];
    const filesWithOpen = new Set<string>();
    for (const abs of files) {
        const rel = path.relative(root, abs).split(path.sep).join('/');
        const text = fs.readFileSync(abs, 'utf8');
        const entries = _blockerEntries(text);
        for (const e of entries) {
            if (/^resolved\b/i.test(e.status)) {
                continue;
            }
            filesWithOpen.add(rel);
            blockers.push({ file: rel, id: e.id, status: e.status, owner: e.owner, wait: _classifyOwner(e.owner) });
        }
        for (const q of _ownerQuestionLines(text)) {
            ownerQuestions.push({ file: rel, line: q.line, text: q.text, blocker_entries_in_file: entries.length });
        }
    }
    return {
        dir: path.relative(root, dir).split(path.sep).join('/'),
        files_scanned: files.length,
        files_with_open_blockers: filesWithOpen.size,
        blockers,
        owner_questions: ownerQuestions,
    };
}

function format(c: Census): string {
    const owner = c.blockers.filter((b) => b.wait === 'owner');
    const agent = c.blockers.filter((b) => b.wait === 'agent');
    const lines: string[] = [];
    lines.push(`Parked blockers under ${c.dir}/`);
    lines.push(
        `files scanned: ${c.files_scanned} · files with an open blocker: ${c.files_with_open_blockers} · open blockers: ${c.blockers.length} (owner-wait ${owner.length}, agent-wait ${agent.length})`,
    );
    for (const [label, group] of [
        ['owner-wait', owner],
        ['agent-wait', agent],
    ] as const) {
        lines.push('');
        lines.push(`## ${label} (${group.length})`);
        for (const b of group) {
            lines.push(`- ${b.file} · ${b.id} · Owner: ${b.owner || '(none)'} · Status: ${b.status || '(none)'}`);
        }
    }
    lines.push('');
    lines.push(`## owner questions in blockquotes (${c.owner_questions.length})`);
    for (const q of c.owner_questions) {
        lines.push(`- ${q.file}:${q.line} · blocker entries in file: ${q.blocker_entries_in_file} · ${q.text.slice(0, 120)}`);
    }
    return `${lines.join('\n')}\n`;
}

function fail(message: string): never {
    process.stderr.write(`report_parked_blockers: ${message}\n`);
    process.exit(2);
}

function main(argv: string[] = process.argv.slice(2)): number {
    let fmt: 'text' | 'json' = 'text';
    let dir = path.join(REPO_ROOT, 'agents', 'roadmaps', 'later');
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--format') {
            const v = argv[i + 1];
            if (v !== 'text' && v !== 'json') fail(`--format must be 'text' or 'json'`);
            fmt = v;
            i += 1;
        } else if (arg === '--dir') {
            const v = argv[i + 1];
            if (v === undefined) fail('--dir requires a value');
            dir = path.resolve(v);
            i += 1;
        } else {
            fail(`unknown argument: ${arg}`);
        }
    }
    const census = collect(dir);
    process.stdout.write(fmt === 'json' ? `${JSON.stringify(census, null, 2)}\n` : format(census));
    return 0;
}

if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main());
        }
    } catch {
        if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
            process.exit(main());
        }
    }
}

export { _classifyOwner, _blockerEntries, _ownerQuestionLines, collect, format, main };
export type { Census, ParkedBlocker, OwnerQuestion };
