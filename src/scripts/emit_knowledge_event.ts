#!/usr/bin/env tsx
/**
 * CLI wrapper for `appendEvent` (src/scripts/_lib/knowledge_events.ts) —
 * road-to-knowledge-system Phase 5. This is the actual command an agent
 * runs to append a typed observation event; the `_lib` module holds the
 * pure schema + validation logic only (this repo's convention: `_lib/`
 * files are never directly invoked).
 *
 * Usage (one flag set per event type — see --help for the full list):
 *   emit_knowledge_event.ts --type convention_detected --pattern "<p>" --evidence "file:line" [--evidence "file:line" ...] --sample-size N --scope project|global
 *   emit_knowledge_event.ts --type mistake_made --error-category "<c>" --context-source "<path>|null" --correction "<text>" --recurrence-key "<key>"
 *   emit_knowledge_event.ts --type api_shape_learned --endpoint "<path>" --method "<verb>" --request-schema "<json>" --response-schema "<json>"
 *   emit_knowledge_event.ts --type context_stale --page-path "<path>" --field "<field>" --expected "<text>" --actual "<text>" --evidence "<text>"
 *
 * Exit codes: 0 = appended, 1 = usage / validation error.
 */
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

import { appendEvent, type KnowledgeEvent } from './_lib/knowledge_events.js';

const PROG = 'emit_knowledge_event.ts';

function printUsage(): void {
    process.stdout.write(
        [
            `usage: ${PROG} --type TYPE [type-specific flags]`,
            '',
            '  --type convention_detected --pattern P --evidence E [--evidence E ...] --sample-size N --scope project|global',
            '  --type mistake_made --error-category C --context-source PATH|null --correction TEXT --recurrence-key KEY',
            '  --type api_shape_learned --endpoint PATH --method VERB --request-schema JSON --response-schema JSON',
            '  --type context_stale --page-path PATH --field FIELD --expected TEXT --actual TEXT --evidence TEXT',
            '',
        ].join('\n'),
    );
}

function parseFlags(argv: string[]): Map<string, string[]> {
    const flags = new Map<string, string[]>();
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) continue;
        const key = arg.slice(2);
        const value = argv[++i] ?? '';
        const existing = flags.get(key) ?? [];
        existing.push(value);
        flags.set(key, existing);
    }
    return flags;
}

function one(flags: Map<string, string[]>, key: string): string | null {
    return flags.get(key)?.[0] ?? null;
}

export function main(argv: string[]): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        printUsage();
        return 0;
    }

    const flags = parseFlags(argv);
    const type = one(flags, 'type');
    const ts = new Date().toISOString();

    let event: KnowledgeEvent;
    try {
        switch (type) {
            case 'convention_detected': {
                const pattern = one(flags, 'pattern');
                const evidence = flags.get('evidence') ?? [];
                const sampleSizeRaw = one(flags, 'sample-size');
                const scope = one(flags, 'scope');
                if (!pattern || evidence.length === 0 || !sampleSizeRaw || (scope !== 'project' && scope !== 'global')) {
                    throw new Error('missing/invalid --pattern, --evidence, --sample-size, or --scope');
                }
                event = {
                    type: 'convention_detected',
                    ts,
                    pattern,
                    evidence,
                    sampleSize: Number.parseInt(sampleSizeRaw, 10),
                    scope,
                };
                break;
            }
            case 'mistake_made': {
                const errorCategory = one(flags, 'error-category');
                const contextSourceRaw = one(flags, 'context-source');
                const correction = one(flags, 'correction');
                const recurrenceKey = one(flags, 'recurrence-key');
                if (!errorCategory || contextSourceRaw === null || !correction || !recurrenceKey) {
                    throw new Error('missing --error-category, --context-source, --correction, or --recurrence-key');
                }
                event = {
                    type: 'mistake_made',
                    ts,
                    errorCategory,
                    contextSource: contextSourceRaw === 'null' ? null : contextSourceRaw,
                    correction,
                    recurrenceKey,
                };
                break;
            }
            case 'api_shape_learned': {
                const endpoint = one(flags, 'endpoint');
                const method = one(flags, 'method');
                const requestSchemaRaw = one(flags, 'request-schema');
                const responseSchemaRaw = one(flags, 'response-schema');
                if (!endpoint || !method || requestSchemaRaw === null || responseSchemaRaw === null) {
                    throw new Error('missing --endpoint, --method, --request-schema, or --response-schema');
                }
                event = {
                    type: 'api_shape_learned',
                    ts,
                    endpoint,
                    method,
                    requestSchema: JSON.parse(requestSchemaRaw),
                    responseSchema: JSON.parse(responseSchemaRaw),
                };
                break;
            }
            case 'context_stale': {
                const pagePath = one(flags, 'page-path');
                const field = one(flags, 'field');
                const expected = one(flags, 'expected');
                const actual = one(flags, 'actual');
                const evidence = one(flags, 'evidence');
                if (!pagePath || !field || expected === null || actual === null || !evidence) {
                    throw new Error('missing --page-path, --field, --expected, --actual, or --evidence');
                }
                event = { type: 'context_stale', ts, pagePath, field, expected, actual, evidence };
                break;
            }
            default:
                throw new Error(`--type must be one of convention_detected|mistake_made|api_shape_learned|context_stale (got "${type}")`);
        }
    } catch (err) {
        process.stderr.write(`${PROG}: error: ${(err as Error).message}\n`);
        printUsage();
        return 1;
    }

    try {
        appendEvent(event);
    } catch (err) {
        process.stderr.write(`${PROG}: error: ${(err as Error).message}\n`);
        return 1;
    }

    process.stdout.write(`${PROG}: appended ${type} event to agents/knowledge/intake/.\n`);
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
