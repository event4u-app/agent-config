#!/usr/bin/env tsx
/**
 * Schema ERD CLI — ER diagrams with git-diff semantics for a project's current and
 * target database structure.
 *
 * Three verbs, one intermediate representation between them:
 *
 *   extract  a state (DDL, Prisma, tbls JSON, or a Laravel probe payload) → IR
 *   diff     two IR documents → an annotated structural difference
 *   render   a diff → a Mermaid map, a change table, or both
 *
 * Purely descriptive: no network, no LLM, no database connection, and no opinion
 * in the exit code about whether a change is safe. Destructiveness judgement
 * belongs to `schema-review`; two locations answering one question diverge.
 *
 * Usage:
 *   ./scripts-run src/scripts/_lib/schema/cli extract --source sql|schema-dump|prisma|tbls-json --in <file>
 *                      [--dialect mysql|mariadb|pgsql|sqlite] [--out <file>]
 *   ./scripts-run src/scripts/_lib/schema/cli extract --source laravel-live|laravel-tmpdb --emit-probe
 *                      [--connection <name>]
 *   ./scripts-run src/scripts/_lib/schema/cli extract --source laravel-live|laravel-tmpdb --from-probe <file>
 *                      [--out <file>]
 *   ./scripts-run src/scripts/_lib/schema/cli diff    --from <ir.json> --to <ir.json> [--rename-map <file>]
 *                      [--scan-renames <migrations-dir>] [--allow-cross-source]
 *                      [--out <file>]
 *   ./scripts-run src/scripts/_lib/schema/cli render  --diff <diff.json> [--view current|target|diff]
 *                      [--format mermaid|table|both] [--compat legacy]
 *                      [--scope all|changed+1hop] [--out <file>]
 *
 * Every verb accepts `--format json` for its findings, and `--quiet`.
 *
 * Exit codes: 0 no gate findings · 1 gate findings · 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDdl } from './adapters/ddl.js';
import { emitProbe, ingestProbe, type LaravelSourceKind } from './adapters/laravel_probe.js';
import { parsePrisma } from './adapters/prisma.js';
import { parseTbls } from './adapters/tbls.js';
import { diffIr, serializeDiff, type RenameMap, type SchemaDiff } from './diff.js';
import {
    DIALECTS,
    scopeHonestyLine,
    serializeIr,
    validateIr,
    type Dialect,
    type Finding,
    type SchemaIr,
} from './ir.js';
import { scanRenames } from './rename_scan.js';
import {
    DEFAULT_SCOPE_THRESHOLD,
    markerLegend,
    omittedTables,
    renderMermaidDiff,
    type Scope,
    type View,
} from './render/mermaid.js';
import { renderChangeTable } from './render/table.js';

const USAGE = `schema_erd — ER diagrams with git-diff semantics.

  extract  --source sql|schema-dump|prisma|tbls-json --in <file>
           [--dialect ${DIALECTS.join('|')}] [--out <file>]
  extract  --source laravel-live|laravel-tmpdb --emit-probe [--connection <name>]
  extract  --source laravel-live|laravel-tmpdb --from-probe <file> [--out <file>]
  diff     --from <ir.json> --to <ir.json> [--rename-map <file>]
           [--scan-renames <dir>] [--allow-cross-source] [--out <file>]
  render   --diff <diff.json> [--view current|target|diff]
           [--format mermaid|table|both] [--compat legacy]
           [--scope all|changed+1hop] [--out <file>]

Common: --format json (findings as JSON) · --quiet · --help

The diagram is the map and the change table is the evidence: markers
[+] [-] [~] [>] are the primary channel, colour is a secondary decoration,
and --compat legacy emits no styling statement at all.
`;

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { verb: string; args: Args } {
    const args: Args = {};
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] ?? '';
        if (a === '--' || a.length === 0) continue;
        if (!a.startsWith('--')) {
            positional.push(a);
            continue;
        }
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
            args[key] = true;
            continue;
        }
        args[key] = next;
        i += 1;
    }
    return { verb: positional[0] ?? '', args };
}

const str = (args: Args, key: string): string | null => (typeof args[key] === 'string' ? (args[key] as string) : null);
const flag = (args: Args, key: string): boolean => args[key] === true || args[key] === 'true';

class UsageError extends Error {}

function resolveDialect(args: Args, fallback: Dialect): Dialect {
    const raw = str(args, 'dialect');
    if (raw === null) return fallback;
    if (!DIALECTS.includes(raw as Dialect)) {
        throw new UsageError(`--dialect must be one of ${DIALECTS.join(', ')}, got "${raw}".`);
    }
    return raw as Dialect;
}

function readInput(args: Args, key: string): { text: string; ref: string } {
    const file = str(args, key);
    if (file === null) throw new UsageError(`--${key} <file> is required.`);
    if (!fs.existsSync(file)) throw new UsageError(`--${key}: no such file: ${file}`);
    // The ref must never carry a host path — a checked-in artefact would leak it.
    return { text: fs.readFileSync(file, 'utf8'), ref: path.basename(file) };
}

function emit(text: string, args: Args): void {
    const out = str(args, 'out');
    if (out === null) {
        process.stdout.write(text);
        return;
    }
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, text, 'utf8');
}

function reportFindings(findings: Finding[], args: Args): number {
    const gates = findings.filter((f) => f.tier === 'gate');
    if (flag(args, 'quiet') && gates.length === 0) return 0;

    if (str(args, 'format') === 'json') {
        process.stderr.write(
            `${JSON.stringify(
                { findings, gate_count: gates.length, advice_count: findings.length - gates.length },
                null,
                2,
            )}\n`,
        );
    } else {
        for (const f of findings) {
            const where = f.at !== undefined ? ` (${f.at})` : '';
            process.stderr.write(`${f.tier === 'gate' ? '❌' : '⚠️ '} ${f.code}${where}: ${f.message}\n`);
        }
    }
    return gates.length > 0 ? 1 : 0;
}

function runExtract(args: Args): number {
    const source = str(args, 'source');
    if (source === null) throw new UsageError('--source is required.');

    if (source === 'laravel-live' || source === 'laravel-tmpdb') {
        if (flag(args, 'emit-probe')) {
            const connection = str(args, 'connection');
            emit(emitProbe(connection === null ? {} : { connection }), args);
            return 0;
        }
        const probeFile = str(args, 'from-probe');
        if (probeFile === null) {
            throw new UsageError(
                `--source ${source} needs either --emit-probe (print the PHP snippet to run inside the project) ` +
                    'or --from-probe <file> (ingest the JSON it printed). This tool never opens a database ' +
                    'connection itself.',
            );
        }
        if (!fs.existsSync(probeFile)) throw new UsageError(`--from-probe: no such file: ${probeFile}`);
        let payload: unknown;
        try {
            payload = JSON.parse(fs.readFileSync(probeFile, 'utf8'));
        } catch (e) {
            throw new UsageError(`--from-probe: ${probeFile} is not valid JSON (${(e as Error).message}).`);
        }
        const ref = str(args, 'ref') ?? str(args, 'connection') ?? 'default';
        const dialectOverride = str(args, 'dialect');
        const result = ingestProbe(payload, {
            kind: source as LaravelSourceKind,
            ref,
            ...(dialectOverride !== null ? { dialect: resolveDialect(args, 'mysql') } : {}),
        });
        const code = reportFindings(result.findings, args);
        if (result.ir === null) return code === 0 ? 1 : code;
        emit(serializeIr(result.ir), args);
        if (!flag(args, 'quiet')) process.stderr.write(`${scopeHonestyLine(result.ir)}\n`);
        return code;
    }

    let ir: SchemaIr;
    if (source === 'sql' || source === 'schema-dump') {
        const input = readInput(args, 'in');
        ir = parseDdl(input.text, { dialect: resolveDialect(args, 'mysql'), kind: source, ref: input.ref });
    } else if (source === 'prisma') {
        const input = readInput(args, 'in');
        ir = parsePrisma(input.text, { dialect: resolveDialect(args, 'mysql'), ref: input.ref });
    } else if (source === 'tbls-json') {
        const input = readInput(args, 'in');
        let doc: unknown;
        try {
            doc = JSON.parse(input.text);
        } catch (e) {
            throw new UsageError(`--in: not valid JSON (${(e as Error).message}).`);
        }
        ir = parseTbls(doc, { dialect: resolveDialect(args, 'mysql'), ref: input.ref });
    } else {
        throw new UsageError(
            `--source "${source}" is not recognised. Use sql, schema-dump, prisma, tbls-json, laravel-live or laravel-tmpdb.`,
        );
    }

    const findings = validateIr(ir);
    const code = reportFindings(findings, args);
    if (code !== 0) return code;
    emit(serializeIr(ir), args);
    if (!flag(args, 'quiet')) process.stderr.write(`${scopeHonestyLine(ir)}\n`);
    return 0;
}

function readIr(file: string, label: string, findings: Finding[]): SchemaIr | null {
    if (!fs.existsSync(file)) throw new UsageError(`--${label}: no such file: ${file}`);
    let doc: unknown;
    try {
        doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        throw new UsageError(`--${label}: ${file} is not valid JSON (${(e as Error).message}).`);
    }
    const problems = validateIr(doc);
    if (problems.length > 0) {
        findings.push(...problems.map((f) => ({ ...f, at: `${label}:${f.at ?? ''}` })));
        return null;
    }
    return doc as SchemaIr;
}

function runDiff(args: Args): number {
    const fromFile = str(args, 'from');
    const toFile = str(args, 'to');
    if (fromFile === null || toFile === null) throw new UsageError('--from <ir.json> and --to <ir.json> are required.');

    const findings: Finding[] = [];
    const from = readIr(fromFile, 'from', findings);
    const to = readIr(toFile, 'to', findings);
    if (from === null || to === null) return reportFindings(findings, args) === 0 ? 1 : 1;

    let renameMap: RenameMap | undefined;
    const renameFile = str(args, 'rename-map');
    if (renameFile !== null) {
        if (!fs.existsSync(renameFile)) throw new UsageError(`--rename-map: no such file: ${renameFile}`);
        try {
            renameMap = JSON.parse(fs.readFileSync(renameFile, 'utf8')) as RenameMap;
        } catch (e) {
            throw new UsageError(`--rename-map: not valid JSON (${(e as Error).message}).`);
        }
    }

    const scanDir = str(args, 'scan-renames');
    if (scanDir !== null) {
        if (!fs.existsSync(scanDir)) throw new UsageError(`--scan-renames: no such directory: ${scanDir}`);
        const scanned = scanRenames(scanDir);
        if (!flag(args, 'quiet')) {
            for (const e of scanned.evidence) {
                const where = e.table !== undefined ? `${e.table}.` : '';
                process.stderr.write(`ℹ️  rename proof: ${where}${e.from} → ${e.to} (${e.file}:${e.line})\n`);
            }
        }
        renameMap = {
            tables: { ...(scanned.map.tables ?? {}), ...(renameMap?.tables ?? {}) },
            columns: { ...(scanned.map.columns ?? {}), ...(renameMap?.columns ?? {}) },
        };
    }

    const result = diffIr(from, to, {
        ...(renameMap !== undefined ? { renameMap } : {}),
        allowCrossSource: flag(args, 'allow-cross-source'),
    });
    findings.push(...result.findings);
    const code = reportFindings(findings, args);
    if (result.diff === null) return code === 0 ? 1 : code;
    emit(serializeDiff(result.diff), args);
    return code;
}

function runRender(args: Args): number {
    const diffFile = str(args, 'diff');
    if (diffFile === null) throw new UsageError('--diff <diff.json> is required.');
    if (!fs.existsSync(diffFile)) throw new UsageError(`--diff: no such file: ${diffFile}`);

    let diff: SchemaDiff;
    try {
        diff = JSON.parse(fs.readFileSync(diffFile, 'utf8')) as SchemaDiff;
    } catch (e) {
        throw new UsageError(`--diff: not valid JSON (${(e as Error).message}).`);
    }
    // An IR document also carries a `tables` array, so that field cannot tell the
    // two apart. `diff_version` can, and feeding the wrong document must produce
    // a usage error rather than a stack trace from deep inside a renderer.
    if (typeof diff.diff_version !== 'number' || !Array.isArray(diff.tables)) {
        throw new UsageError(
            '--diff: document carries no `diff_version` — is it a diff, or an IR? ' +
                'Run `diff --from <ir> --to <ir>` first and pass its output here.',
        );
    }

    const view = (str(args, 'view') ?? 'diff') as View;
    if (view !== 'current' && view !== 'target' && view !== 'diff') {
        throw new UsageError(`--view must be current, target or diff, got "${view}".`);
    }
    const format = str(args, 'format') ?? 'both';
    if (format !== 'mermaid' && format !== 'table' && format !== 'both' && format !== 'json') {
        throw new UsageError(`--format must be mermaid, table, both or json, got "${format}".`);
    }
    const scopeRaw = str(args, 'scope');
    if (scopeRaw !== null && scopeRaw !== 'all' && scopeRaw !== 'changed+1hop') {
        throw new UsageError(`--scope must be all or changed+1hop, got "${scopeRaw}".`);
    }
    const compat = str(args, 'compat');
    if (compat !== null && compat !== 'legacy' && compat !== 'default') {
        throw new UsageError(`--compat must be legacy or default, got "${compat}".`);
    }

    const mermaidOptions = {
        view,
        ...(compat === 'legacy' ? { compat: 'legacy' as const } : {}),
        ...(scopeRaw !== null ? { scope: scopeRaw as Scope } : {}),
        scopeThreshold: DEFAULT_SCOPE_THRESHOLD,
    };

    const parts: string[] = [];
    if (format === 'mermaid' || format === 'both') {
        parts.push('```mermaid');
        parts.push(renderMermaidDiff(diff, mermaidOptions).trimEnd());
        parts.push('```');
        parts.push('');
        parts.push(markerLegend());
        parts.push('');
    }
    if (format === 'table' || format === 'both' || format === 'json') {
        parts.push(
            renderChangeTable(diff, { omittedFromDiagram: omittedTables(diff, mermaidOptions) }).trimEnd(),
        );
    }

    emit(`${parts.join('\n')}\n`, args);
    return 0;
}

export function main(argv: string[]): number {
    const { verb, args } = parseArgs(argv);

    if (flag(args, 'help') || verb === 'help' || verb === '') {
        process.stdout.write(USAGE);
        return verb === '' && !flag(args, 'help') ? 2 : 0;
    }

    try {
        if (verb === 'extract') return runExtract(args);
        if (verb === 'diff') return runDiff(args);
        if (verb === 'render') return runRender(args);
        process.stderr.write(`Unknown verb "${verb}". Use extract, diff or render.\n\n${USAGE}`);
        return 2;
    } catch (e) {
        if (e instanceof UsageError) {
            process.stderr.write(`❌ ${e.message}\n`);
            return 2;
        }
        throw e;
    }
}

const invokedDirectly = (() => {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    try {
        return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
})();

if (invokedDirectly) process.exit(main(process.argv.slice(2)));
