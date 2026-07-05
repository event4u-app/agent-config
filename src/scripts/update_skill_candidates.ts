#!/usr/bin/env tsx
/**
 * Cross-cycle recurrence tracker for `agents/knowledge/procedures/skill-candidates.md`
 * — road-to-knowledge-system Phase 2 (capture hygiene).
 *
 * Each `/memory:mine-session` / `memory-consolidation` cycle that finds an
 * unpromoted, recurring topic calls this to increment a durable per-topic
 * counter. At >= 3 mentions the topic is a live skill/procedure candidate —
 * `learning-to-rule-or-skill` picks it up from here for human-gated
 * promotion. This script only maintains the counter file; it never proposes
 * or writes a skill/rule itself.
 *
 * Usage:
 *   update_skill_candidates.ts --topic <slug> --session <id> --date <YYYY-MM-DD> [--file <path>]
 *
 * Exit codes: 0 = updated (prints whether the candidate threshold (3) was
 * crossed BY this call), 1 = usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROG = 'update_skill_candidates.ts';
export const CANDIDATE_THRESHOLD = 3;
const DEFAULT_FILE = path.join('agents', 'knowledge', 'procedures', 'skill-candidates.md');

export interface CandidateRecord {
    topic: string;
    mentions: number;
    first: string; // YYYY-MM-DD
    lastSeen: string; // YYYY-MM-DD
    sessions: string[]; // unique, insertion order
}

const HEADING_RE = /^## (.+)$/;
const FIELD_RE = /^- (\w[\w ]*): (.*)$/;

/** Parse the skill-candidates.md body into topic → record. Tolerant of a missing/empty file. */
export function parseCandidates(body: string): Map<string, CandidateRecord> {
    const out = new Map<string, CandidateRecord>();
    let current: CandidateRecord | null = null;

    for (const rawLine of body.split(/\r?\n/)) {
        const headingMatch = HEADING_RE.exec(rawLine);
        if (headingMatch) {
            current = { topic: headingMatch[1].trim(), mentions: 0, first: '', lastSeen: '', sessions: [] };
            out.set(current.topic, current);
            continue;
        }
        if (!current) continue;
        const fieldMatch = FIELD_RE.exec(rawLine);
        if (!fieldMatch) continue;
        const [, key, value] = fieldMatch;
        if (key === 'Mentions') current.mentions = Number.parseInt(value, 10) || 0;
        else if (key === 'First seen') current.first = value.trim();
        else if (key === 'Last seen') current.lastSeen = value.trim();
        else if (key === 'Sessions') {
            current.sessions = value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        }
    }
    return out;
}

export function renderCandidates(records: Map<string, CandidateRecord>): string {
    const lines: string[] = [];
    lines.push('# Skill Candidates');
    lines.push('');
    lines.push(
        `_Auto-maintained by \`src/scripts/update_skill_candidates.ts\`. A topic reaches candidate status at ${CANDIDATE_THRESHOLD}+ mentions across distinct sessions — see \`learning-to-rule-or-skill\` for the human-gated promotion path._`,
    );

    const topics = [...records.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const topic of topics) {
        const r = records.get(topic)!;
        lines.push('');
        lines.push(`## ${r.topic}`);
        lines.push('');
        lines.push(`- Mentions: ${r.mentions}`);
        lines.push(`- First seen: ${r.first}`);
        lines.push(`- Last seen: ${r.lastSeen}`);
        lines.push(`- Sessions: ${r.sessions.join(', ')}`);
    }
    lines.push('');
    return lines.join('\n');
}

/** Increment (or create) a topic's recurrence record. Mutates and returns the map; returns whether this call crossed the candidate threshold. */
export function upsertCandidate(
    records: Map<string, CandidateRecord>,
    topic: string,
    sessionId: string,
    date: string,
): { crossedThreshold: boolean; record: CandidateRecord } {
    let record = records.get(topic);
    const wasBelowThreshold = !record || record.mentions < CANDIDATE_THRESHOLD;

    if (!record) {
        record = { topic, mentions: 0, first: date, lastSeen: date, sessions: [] };
        records.set(topic, record);
    }

    if (!record.sessions.includes(sessionId)) {
        record.sessions.push(sessionId);
        record.mentions += 1;
    }
    record.lastSeen = date;

    const crossedThreshold = wasBelowThreshold && record.mentions >= CANDIDATE_THRESHOLD;
    return { crossedThreshold, record };
}

function printUsage(): void {
    process.stderr.write(`usage: ${PROG} --topic TOPIC --session ID --date YYYY-MM-DD [--file PATH]\n`);
}

export function main(argv: string[]): number {
    let topic: string | null = null;
    let session: string | null = null;
    let date: string | null = null;
    let file = DEFAULT_FILE;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            printUsage();
            return 0;
        } else if (arg === '--topic') {
            topic = argv[++i] ?? null;
        } else if (arg === '--session') {
            session = argv[++i] ?? null;
        } else if (arg === '--date') {
            date = argv[++i] ?? null;
        } else if (arg === '--file') {
            file = argv[++i] ?? file;
        } else {
            process.stderr.write(`${PROG}: error: unrecognized argument: ${arg}\n`);
            printUsage();
            return 1;
        }
    }

    if (!topic || !session || !date) {
        process.stderr.write(`${PROG}: error: --topic, --session, and --date are required\n`);
        printUsage();
        return 1;
    }

    const existingBody = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const records = parseCandidates(existingBody);
    const { crossedThreshold, record } = upsertCandidate(records, topic, session, date);

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderCandidates(records), 'utf8');

    if (crossedThreshold) {
        process.stdout.write(
            `${PROG}: "${topic}" reached candidate status (${record.mentions} mentions) — surface for learning-to-rule-or-skill.\n`,
        );
    } else {
        process.stdout.write(`${PROG}: "${topic}" now at ${record.mentions} mention(s).\n`);
    }
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
