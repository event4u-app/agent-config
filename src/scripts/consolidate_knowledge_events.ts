#!/usr/bin/env tsx
/**
 * Consolidation report generator for `/team-knowledge consolidate` —
 * road-to-knowledge-system Phase 5. Reads the pending typed-observation
 * intake, aggregates by topic, and finds the nearest existing knowledge
 * page for each aggregate (mechanical similarity only). It NEVER decides
 * NEW/EXTEND/CONFIRM/CONFLICT and NEVER writes a page — per the council
 * verdict, that triage is always a human-reviewed judgment call the
 * command prose makes from this report.
 *
 * Default mode prints the report and exits — intake is untouched.
 * `--commit` additionally clears the consumed intake AFTER printing,
 * for use once the agent has written the reviewed batch (mirrors
 * memory-consolidation's --preview / --commit-intake split).
 *
 * Usage:
 *   consolidate_knowledge_events.ts [--intake-dir <dir>] [--knowledge-dir <dir>] [--format text|json] [--commit]
 *
 * Exit codes: 0 = report printed (regardless of pending-event count), 1 = usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { findMostSimilar, type Candidate } from './_lib/text_similarity.js';
import { clearAllEvents, readAllEvents, type KnowledgeEvent } from './_lib/knowledge_events.js';

const PROG = 'consolidate_knowledge_events.ts';
const DEFAULT_INTAKE_DIR = path.join('agents', 'knowledge', 'intake');
const DEFAULT_KNOWLEDGE_DIR = path.join('agents', 'knowledge');
const PAGE_DIRS = ['concepts', 'procedures'] as const;

/** Stable aggregation key per event type — events with the same key describe the same emerging topic. */
export function aggregationKey(event: KnowledgeEvent): string {
    switch (event.type) {
        case 'convention_detected':
            return `convention:${event.pattern}`;
        case 'mistake_made':
            return `mistake:${event.recurrenceKey}`;
        case 'api_shape_learned':
            return `api:${event.method} ${event.endpoint}`;
        case 'context_stale':
            return `stale:${event.pagePath}#${event.field}`;
    }
}

/** Short human-readable text representing the aggregate, used for the similarity scan against existing pages. */
function aggregateText(event: KnowledgeEvent): string {
    switch (event.type) {
        case 'convention_detected':
            return event.pattern;
        case 'mistake_made':
            return `${event.errorCategory} ${event.correction}`;
        case 'api_shape_learned':
            return `${event.method} ${event.endpoint}`;
        case 'context_stale':
            return `${event.field} ${String(event.expected)} ${String(event.actual)}`;
    }
}

export interface AggregateGroup {
    key: string;
    events: KnowledgeEvent[];
    nearestPage: { path: string; score: number } | null;
}

function listMarkdownFiles(dirPath: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name);
}

function loadPageCandidates(knowledgeDir: string): Candidate[] {
    const out: Candidate[] = [];
    for (const dir of PAGE_DIRS) {
        const scanDir = path.join(knowledgeDir, dir);
        for (const file of listMarkdownFiles(scanDir)) {
            let text = '';
            try {
                text = fs.readFileSync(path.join(scanDir, file), 'utf8');
            } catch {
                continue;
            }
            out.push({ id: `${dir}/${file}`, text });
        }
    }
    return out;
}

/** Pure aggregation + similarity-scan step. Never touches disk beyond the passed-in candidates. */
export function buildReport(events: KnowledgeEvent[], pageCandidates: Candidate[]): AggregateGroup[] {
    const groups = new Map<string, KnowledgeEvent[]>();
    for (const event of events) {
        const key = aggregationKey(event);
        const bucket = groups.get(key) ?? [];
        bucket.push(event);
        groups.set(key, bucket);
    }

    const out: AggregateGroup[] = [];
    for (const [key, groupEvents] of groups) {
        const representative = aggregateText(groupEvents[0]);
        const match = findMostSimilar(representative, pageCandidates);
        out.push({
            key,
            events: groupEvents,
            nearestPage: match && match.classification !== 'create' ? { path: match.id, score: match.score } : null,
        });
    }
    return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function renderText(report: AggregateGroup[]): string {
    if (report.length === 0) return `${PROG}: no pending knowledge events.\n`;
    const lines: string[] = [`${PROG}: ${report.length} topic(s) pending review.`, ''];
    for (const group of report) {
        lines.push(`## ${group.key} (${group.events.length} event(s))`);
        if (group.nearestPage) {
            lines.push(
                `  Nearest existing page: ${group.nearestPage.path} (${(group.nearestPage.score * 100).toFixed(0)}% similar) — triage EXTEND/CONFIRM/CONFLICT`,
            );
        } else {
            lines.push('  No similar existing page found — triage NEW');
        }
        lines.push('');
    }
    return lines.join('\n');
}

function printUsage(): void {
    process.stdout.write(`usage: ${PROG} [--intake-dir DIR] [--knowledge-dir DIR] [--format text|json] [--commit]\n`);
}

export function main(argv: string[]): number {
    let intakeDir = DEFAULT_INTAKE_DIR;
    let knowledgeDir = DEFAULT_KNOWLEDGE_DIR;
    let format: 'text' | 'json' = 'text';
    let commit = false;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            printUsage();
            return 0;
        } else if (arg === '--intake-dir') {
            intakeDir = argv[++i] ?? intakeDir;
        } else if (arg === '--knowledge-dir') {
            knowledgeDir = argv[++i] ?? knowledgeDir;
        } else if (arg === '--format') {
            const value = argv[++i];
            if (value !== 'text' && value !== 'json') {
                process.stderr.write(`${PROG}: error: --format must be text or json\n`);
                return 1;
            }
            format = value;
        } else if (arg === '--commit') {
            commit = true;
        } else {
            process.stderr.write(`${PROG}: error: unrecognized argument: ${arg}\n`);
            printUsage();
            return 1;
        }
    }

    const events = readAllEvents(intakeDir);
    const candidates = loadPageCandidates(knowledgeDir);
    const report = buildReport(events, candidates);

    if (format === 'json') {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(renderText(report));
    }

    if (commit) {
        clearAllEvents(intakeDir);
        process.stdout.write(`${PROG}: intake cleared.\n`);
    }

    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
