#!/usr/bin/env tsx
/**
 * Team-sharing gate for `agents/knowledge/` — road-to-knowledge-system
 * Phase 3. Pre-commit check: storage location IS the sharing policy (per
 * the 2026-07-05 council verdict), so this gate exists to catch the two
 * ways that policy can be violated by accident:
 *
 *   1. A gitignored intake file staged anyway (via `git add -f` or a
 *      misconfigured .gitignore) — BLOCK. Intake is local scratch; it
 *      must never reach a commit.
 *   2. A page under `agents/knowledge/` carrying `visibility: private`
 *      in its frontmatter — BLOCK. A private-scoped entry belongs in the
 *      user-global store, never in the team-shared repo path (mirrors
 *      the "link" reference's team-sync share-readiness gate).
 *
 * Creation budget (≥ 5 NEW files under `agents/knowledge/` in one
 * commit) is a WARNING, not a block — large legitimate batches (e.g. a
 * bootstrap run) should not be hard-refused, just flagged for a second
 * look.
 *
 * Usage: check_knowledge_sharing.ts [--staged-files <path-list-file>]
 * Without --staged-files, reads the real `git diff --cached` state.
 *
 * Exit codes: 0 = clean or warn-only, 1 = blocked, 3 = internal error.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const PROG = 'check_knowledge_sharing.ts';
const CREATION_BUDGET_WARN = 5;
const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/;

export interface StagedFile {
    path: string;
    status: 'A' | 'M' | 'D' | 'R' | string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parse `git diff --cached --name-status` output (also accepted pre-split for tests). */
export function parseNameStatus(raw: string): StagedFile[] {
    const out: StagedFile[] = [];
    for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        const [status, ...rest] = line.split('\t');
        const path = rest[rest.length - 1]; // renames carry old\tnew — keep the new path
        if (!status || !path) continue;
        out.push({ path, status: status[0] });
    }
    return out;
}

export interface SharingReport {
    blocked: string[]; // human-readable block reasons
    warnings: string[]; // human-readable warnings
}

/** Pure — takes staged files + a content-reader so tests never touch the real filesystem or git. */
export function checkSharing(staged: StagedFile[], readContent: (path: string) => string | null): SharingReport {
    const blocked: string[] = [];
    const warnings: string[] = [];

    const intakeFiles = staged.filter(
        (f) => f.path.startsWith('agents/memory/intake/') || f.path.startsWith('agents/knowledge/intake/'),
    );
    for (const f of intakeFiles) {
        blocked.push(`${f.path}: gitignored intake staged — intake is local scratch, never committed`);
    }

    const knowledgeFiles = staged.filter(
        (f) => f.path.startsWith('agents/knowledge/') && !f.path.startsWith('agents/knowledge/intake/') && f.path.endsWith('.md'),
    );
    for (const f of knowledgeFiles) {
        const content = readContent(f.path);
        if (content === null) continue;
        const match = FRONTMATTER_RE.exec(content);
        if (!match) continue;
        let fm: unknown;
        try {
            fm = YAML.parse(match[1]);
        } catch {
            continue;
        }
        if (isPlainObject(fm) && fm.visibility === 'private') {
            blocked.push(`${f.path}: visibility: private — belongs in the user-global knowledge store, not the team-shared repo`);
        }
    }

    const newKnowledgeFiles = staged.filter(
        (f) => f.status === 'A' && f.path.startsWith('agents/knowledge/') && !f.path.startsWith('agents/knowledge/intake/'),
    );
    if (newKnowledgeFiles.length >= CREATION_BUDGET_WARN) {
        warnings.push(
            `${newKnowledgeFiles.length} new files under agents/knowledge/ in this commit — review the batch (creation budget: ${CREATION_BUDGET_WARN})`,
        );
    }

    return { blocked, warnings };
}

function gitStagedNameStatus(): string {
    return execFileSync('git', ['diff', '--cached', '--name-status'], { encoding: 'utf8' });
}

function gitStagedContent(path: string): string | null {
    try {
        return execFileSync('git', ['show', `:${path}`], { encoding: 'utf8' });
    } catch {
        return null;
    }
}

function printUsage(): void {
    process.stdout.write(`usage: ${PROG}\n`);
}

export function main(argv: string[]): number {
    for (const arg of argv) {
        if (arg === '-h' || arg === '--help') {
            printUsage();
            return 0;
        }
        process.stderr.write(`${PROG}: error: unrecognized argument: ${arg}\n`);
        printUsage();
        return 1;
    }

    let staged: StagedFile[];
    try {
        staged = parseNameStatus(gitStagedNameStatus());
    } catch (err) {
        process.stderr.write(`${PROG}: error: git diff --cached failed: ${(err as Error).message}\n`);
        return 3;
    }

    const { blocked, warnings } = checkSharing(staged, gitStagedContent);

    for (const w of warnings) {
        process.stdout.write(`🟡 ${w}\n`);
    }

    if (blocked.length > 0) {
        for (const b of blocked) {
            process.stderr.write(`❌ ${b}\n`);
        }
        process.stderr.write(`${PROG}: commit blocked — ${blocked.length} sharing violation(s).\n`);
        return 1;
    }

    process.stdout.write(`${PROG}: sharing gate clear.\n`);
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
