#!/usr/bin/env tsx
/**
 * Warn-only scale + budget tripwires for the memory/knowledge substrate —
 * road-to-second-brain Phase 0 (council 2026-07-07, see
 * `agents/settings/contexts/second-brain-delta-verdict.md`).
 *
 * These tripwires REPLACE roadmap gates: each warning names its pre-decided
 * activation path, so a firing tripwire is actionable without re-opening the
 * decision. The script never fails the build.
 *
 * Tripwires:
 *   - intake scale     — `agents/knowledge/intake/events-*.jsonl` > 2000 events
 *                        → wire `fold_intake.ts` into post-session/CI
 *   - sessions scale   — `agents/knowledge/sessions/` > 50 pages
 *                        → design fold-through-consolidate-gate for tracked pages
 *   - type scale       — any single memory/knowledge type > 200 files
 *                        → rank via `_lib/lexical_index.ts` (hand-rolled BM25 +
 *                          trigram, no engine fork / no FTS5; ADR-061 honoured)
 *   - corpus scale     — > 500 files across all types
 *                        → same lexical-index activation path
 *   - hot-context size — `agents/runtime/state/hot-context.md` > 600 tokens
 *                        (estimated at 4 chars/token) → trim schema / fix the
 *                        deterministic writer
 *
 * Usage: lint_knowledge_scale.ts [--dir <repo-root>] [--format text|json] [--quiet]
 * Exit codes: 0 = ran cleanly (warnings never fail the build), 1 = usage
 * error, 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROG = 'lint_knowledge_scale.ts';

export const INTAKE_EVENTS_MAX = 2000;
export const SESSIONS_PAGES_MAX = 50;
export const TYPE_FILES_MAX = 200;
export const CORPUS_FILES_MAX = 500;
export const HOT_CONTEXT_TOKENS_MAX = 600;
export const CHARS_PER_TOKEN = 4;

const KNOWLEDGE_TYPED_DIRS = ['sessions', 'concepts', 'procedures', 'decisions'] as const;

export interface Warning {
    rule: string;
    metric: string; // "<observed>/<threshold>"
    message: string; // includes the pre-decided activation path
}

function listFiles(dir: string, exts: readonly string[]): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isFile() && exts.some((x) => e.name.endsWith(x)))
        .map((e) => path.join(dir, e.name));
}

function countJsonlLines(file: string): number {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return 0;
    }
    return text.split('\n').filter((l) => l.trim().length > 0).length;
}

/** Collect per-type file counts across the knowledge + memory substrate. */
export function collectTypeCounts(root: string): Map<string, number> {
    const counts = new Map<string, number>();

    // Knowledge cards (flat, top-level *.md except README/INDEX).
    const cardsDir = path.join(root, 'agents', 'knowledge');
    const cards = listFiles(cardsDir, ['.md']).filter((f) => {
        const base = path.basename(f).toLowerCase();
        return base !== 'readme.md' && base !== 'index.md';
    });
    counts.set('knowledge/cards', cards.length);

    // Lifecycle-typed knowledge dirs.
    for (const d of KNOWLEDGE_TYPED_DIRS) {
        counts.set(`knowledge/${d}`, listFiles(path.join(cardsDir, d), ['.md']).length);
    }

    // Curated memory types: agents/memory/<type>/ dirs and <type>.yml files.
    // The gitignored per-task scratch (`agents/memory/knowledge/`) is excluded —
    // it is session state, not a curated type.
    const memoryDir = path.join(root, 'agents', 'memory');
    let memEntries: fs.Dirent[] = [];
    try {
        memEntries = fs.readdirSync(memoryDir, { withFileTypes: true });
    } catch {
        // no memory dir — fine
    }
    for (const e of memEntries) {
        if (e.isDirectory()) {
            if (e.name === 'knowledge' || e.name === 'intake' || e.name === 'archive') continue;
            const n = listFiles(path.join(memoryDir, e.name), ['.md', '.yml', '.yaml']).length;
            counts.set(`memory/${e.name}`, n);
        } else if (e.isFile() && (e.name.endsWith('.yml') || e.name.endsWith('.yaml'))) {
            counts.set(`memory/${e.name}`, 1);
        }
    }
    return counts;
}

export function runChecks(root: string): Warning[] {
    const warnings: Warning[] = [];

    // 1. Intake scale.
    const intakeDir = path.join(root, 'agents', 'knowledge', 'intake');
    const intakeFiles = listFiles(intakeDir, ['.jsonl']).filter((f) =>
        path.basename(f).startsWith('events-'),
    );
    const intakeEvents = intakeFiles.reduce((acc, f) => acc + countJsonlLines(f), 0);
    if (intakeEvents > INTAKE_EVENTS_MAX) {
        warnings.push({
            rule: 'intake-scale',
            metric: `${intakeEvents}/${INTAKE_EVENTS_MAX}`,
            message:
                `intake holds ${intakeEvents} events (> ${INTAKE_EVENTS_MAX}). ` +
                'Activation path (pre-decided): wire `src/scripts/fold_intake.ts` into the post-session/CI cadence.',
        });
    }

    // 2. Sessions scale.
    const sessionsDir = path.join(root, 'agents', 'knowledge', 'sessions');
    const sessionPages = listFiles(sessionsDir, ['.md']).length;
    if (sessionPages > SESSIONS_PAGES_MAX) {
        warnings.push({
            rule: 'sessions-scale',
            metric: `${sessionPages}/${SESSIONS_PAGES_MAX}`,
            message:
                `agents/knowledge/sessions/ holds ${sessionPages} pages (> ${SESSIONS_PAGES_MAX}). ` +
                'Activation path (pre-decided): design fold-through-consolidate-gate for tracked pages — never fold tracked files without the gate.',
        });
    }

    // 3 + 4. Type + corpus scale.
    const typeCounts = collectTypeCounts(root);
    let total = 0;
    for (const [type, n] of typeCounts) {
        total += n;
        if (n > TYPE_FILES_MAX) {
            warnings.push({
                rule: 'type-scale',
                metric: `${n}/${TYPE_FILES_MAX}`,
                message:
                    `type '${type}' holds ${n} files (> ${TYPE_FILES_MAX}). ` +
                    'Activation path (resolved, road-to-retrieval-substrate-hardening B2): rank via the hand-rolled BM25 + trigram index in `_lib/lexical_index.ts` (pure stdlib, NO engine fork / NO SQLite-FTS5, ADR-061 honoured). Measured lift: mean tie-set 3.333 → 1.0 (internal/bench/reports/lexical-ranking.json). Wire it lazily at first lookup + a stat-index, no vectors, no service.',
            });
        }
    }
    if (total > CORPUS_FILES_MAX) {
        warnings.push({
            rule: 'corpus-scale',
            metric: `${total}/${CORPUS_FILES_MAX}`,
            message:
                `memory/knowledge corpus holds ${total} files (> ${CORPUS_FILES_MAX}). ` +
                'Activation path (pre-decided): build the file-first in-memory BM25 CLI (re-index at session start, no vectors, no service).',
        });
    }

    // 6. Contested cards — surface knowledge cards flagged `contested: true`
    //    (set when `check_memory_contradiction.ts` fires) so a weak / disputed
    //    claim stays visibly weak across sessions instead of silently hardening.
    const cardsDir = path.join(root, 'agents', 'knowledge');
    const contested = listFiles(cardsDir, ['.md'])
        .filter((f) => {
            const base = path.basename(f).toLowerCase();
            return base !== 'readme.md' && base !== 'index.md';
        })
        .filter((f) => {
            let text: string;
            try {
                text = fs.readFileSync(f, 'utf-8');
            } catch {
                return false;
            }
            // frontmatter-scoped: `contested: true` on its own line near the top.
            return /^\s*contested:\s*true\s*$/m.test(text.slice(0, 2000));
        })
        .map((f) => path.basename(f));
    if (contested.length > 0) {
        warnings.push({
            rule: 'contested-cards',
            metric: `${contested.length}/0`,
            message:
                `${contested.length} knowledge card(s) carry \`contested: true\`: ${contested.join(', ')}. ` +
                'Resolution path: reconcile each against its `contradictions: [id]` list (human-judged) — a contested claim must not be cited as settled until resolved.',
        });
    }

    // 5. Hot-context budget.
    const hotContext = path.join(root, 'agents', 'runtime', 'state', 'hot-context.md');
    let hotText = '';
    try {
        hotText = fs.readFileSync(hotContext, 'utf-8');
    } catch {
        // absent — fine (feature not active or fresh session)
    }
    if (hotText) {
        const tokens = Math.ceil(hotText.length / CHARS_PER_TOKEN);
        if (tokens > HOT_CONTEXT_TOKENS_MAX) {
            warnings.push({
                rule: 'hot-context-budget',
                metric: `${tokens}/${HOT_CONTEXT_TOKENS_MAX}`,
                message:
                    `hot-context.md parses to ~${tokens} tokens (> ${HOT_CONTEXT_TOKENS_MAX}). ` +
                    'Activation path (pre-decided): trim the schema sections or fix the deterministic writer cap.',
            });
        }
    }

    return warnings;
}

function main(argv: string[]): number {
    let dir = '.';
    let format = 'text';
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dir') {
            dir = argv[++i] ?? '';
            if (!dir) {
                process.stderr.write(`${PROG}: error: --dir requires a value\n`);
                return 1;
            }
        } else if (a === '--format') {
            format = argv[++i] ?? '';
            if (format !== 'text' && format !== 'json') {
                process.stderr.write(`${PROG}: error: --format must be text|json\n`);
                return 1;
            }
        } else if (a === '--quiet') {
            quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                `usage: ${PROG} [--dir <repo-root>] [--format text|json] [--quiet]\n`,
            );
            return 0;
        } else {
            process.stderr.write(`${PROG}: error: unknown argument ${a}\n`);
            return 1;
        }
    }

    let warnings: Warning[];
    try {
        warnings = runChecks(path.resolve(dir));
    } catch (exc) {
        process.stderr.write(`${PROG}: internal error: ${String(exc)}\n`);
        return 3;
    }

    if (format === 'json') {
        process.stdout.write(JSON.stringify({ warnings }, null, 2) + '\n');
    } else if (warnings.length === 0) {
        if (!quiet) {
            process.stdout.write(`${PROG}: all scale tripwires silent (warn-only)\n`);
        }
    } else {
        for (const w of warnings) {
            process.stdout.write(`⚠️  [${w.rule}] ${w.metric} — ${w.message}\n`);
        }
        process.stdout.write(
            `${PROG}: ${warnings.length} tripwire(s) fired — warn-only, build not failed\n`,
        );
    }
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
