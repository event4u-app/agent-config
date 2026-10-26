/**
 * Tests for the schema-erd renderers and the CLI entry point.
 *
 * The load-bearing assertion in this file is the one that proves the design
 * inversion actually holds: strip every styling statement from the diff view
 * and it must still carry the full change classification. If that fails, colour
 * has silently become the primary channel and the diagram is unreadable on any
 * renderer that cannot style it.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { afterAll, describe, expect, it } from 'vitest';

import { parseDdl } from '../../src/scripts/_lib/schema/adapters/ddl.js';
import { diffIr, type SchemaDiff } from '../../src/scripts/_lib/schema/diff.js';
import {
    markerLegend,
    omittedTables,
    renderMermaidDiff,
    renderMermaidIr,
} from '../../src/scripts/_lib/schema/render/mermaid.js';
import { changeRows, renderChangeTable } from '../../src/scripts/_lib/schema/render/table.js';
import type { SchemaIr } from '../../src/scripts/_lib/schema/ir.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'schema-erd');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const SCRIPT = path.join(REPO, 'src', 'scripts', '_lib', 'schema', 'cli.ts');
const read = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const current = (): SchemaIr => parseDdl(read('current.sql'), { dialect: 'mysql', kind: 'sql', ref: 'current.sql' });
const target = (): SchemaIr => parseDdl(read('target.sql'), { dialect: 'mysql', kind: 'sql', ref: 'target.sql' });
const diff = (): SchemaDiff => diffIr(current(), target()).diff as SchemaDiff;

/** Every styling statement removed — what an older renderer effectively sees. */
const stripStyling = (text: string): string =>
    text
        .split('\n')
        .filter((l) => !/^\s*(classDef|class|style)\s/.test(l))
        .join('\n');

describe('renderMermaidDiff — markers are the primary channel', () => {
    const rendered = renderMermaidDiff(diff(), { view: 'diff' });

    it('emits a parseable erDiagram header', () => {
        expect(rendered.startsWith('erDiagram\n')).toBe(true);
    });

    // This is the inversion. If it regresses, the diff is only readable on a
    // renderer that can colour, which is exactly what was measured to fail.
    it('carries the full classification with every styling statement stripped', () => {
        const bare = stripStyling(rendered);
        expect(bare).not.toMatch(/classDef|class |style /);
        expect(bare).toContain('[+] invoices');
        expect(bare).toContain('[-] legacy_audit');
        expect(bare).toContain('[~] orders');
        expect(bare).toContain('[~] users');
        expect(bare).toContain('[~] type');
        expect(bare).toContain('[~] on_delete');
    });

    it('marks each changed column with its status and short code', () => {
        expect(rendered).toMatch(/name\s+"\[~\] type"/);
        expect(rendered).toMatch(/locale\s+"\[\+\]"/);
        expect(rendered).toMatch(/note\s+"\[-\]"/);
    });

    it('leaves an unchanged column unmarked', () => {
        const statusLine = rendered.split('\n').find((l) => l.trim().endsWith(' status'));
        expect(statusLine).toBeDefined();
        expect(statusLine).not.toContain('[');
    });

    it('decorates tables with classDef and class in the default compat mode', () => {
        expect(rendered).toContain('classDef added');
        expect(rendered).toContain('classDef removed');
        expect(rendered).toContain('classDef modified');
        expect(rendered).toContain('class invoices added');
        expect(rendered).toContain('class legacy_audit removed');
    });

    // An older renderer does not drop unknown styling statements, it fails to
    // parse the diagram — so legacy mode must emit none of them at all.
    it('emits no styling statement whatsoever under --compat legacy', () => {
        const legacy = renderMermaidDiff(diff(), { view: 'diff', compat: 'legacy' });
        expect(legacy).not.toContain('classDef');
        expect(legacy).not.toMatch(/^\s*class\s/m);
        expect(legacy).not.toMatch(/^\s*style\s/m);
        expect(legacy).toContain('[~] type');
    });

    it('colours a foreign-key edge by its own status, not by its tables', () => {
        // `users` and `orders` both changed, but the edge's own change is the
        // referential action, and that is what the label must say.
        expect(rendered).toContain('users ||--o{ orders : "[~] on_delete"');
    });

    it('reduces a composite type to a single token the grammar accepts', () => {
        expect(rendered).toMatch(/^\s+enum status$/m);
        expect(rendered).not.toContain("enum('active'");
    });

    it('emits PK, FK and UK key tokens', () => {
        expect(rendered).toMatch(/bigint_unsigned id PK/);
        expect(rendered).toMatch(/bigint_unsigned user_id FK/);
        expect(rendered).toMatch(/varchar\(255\) email UK/);
    });

    it('is byte-stable across two renders', () => {
        expect(renderMermaidDiff(diff(), { view: 'diff' })).toBe(rendered);
    });

    it('carries no host path and no timestamp', () => {
        expect(rendered).not.toMatch(/\/Users\/|\/home\//);
        expect(rendered).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    });
});

describe('renderMermaidDiff — the current and target views', () => {
    it('omits added elements from the current view', () => {
        const view = renderMermaidDiff(diff(), { view: 'current' });
        expect(view).not.toContain('invoices');
        expect(view).toContain('legacy_audit');
        expect(view).toContain('note');
        expect(view).not.toContain('locale');
    });

    it('omits removed elements from the target view', () => {
        const view = renderMermaidDiff(diff(), { view: 'target' });
        expect(view).toContain('invoices');
        expect(view).not.toContain('legacy_audit');
        expect(view).not.toMatch(/^\s+text note/m);
        expect(view).toContain('locale');
    });

    it('carries no change marker in a single-state view', () => {
        expect(renderMermaidDiff(diff(), { view: 'current' })).not.toContain('[~]');
        expect(renderMermaidDiff(diff(), { view: 'target' })).not.toContain('[+]');
    });
});

describe('renderMermaidDiff — scoping', () => {
    /** A schema whose changed table has one neighbour and two strangers. */
    function wideDiff(): SchemaDiff {
        const from = parseDdl(
            [
                'CREATE TABLE `users` (`id` int NOT NULL, PRIMARY KEY (`id`));',
                'CREATE TABLE `orders` (`id` int NOT NULL, `user_id` int NOT NULL, PRIMARY KEY (`id`), CONSTRAINT `o_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`));',
                'CREATE TABLE `settings` (`id` int NOT NULL, PRIMARY KEY (`id`));',
                'CREATE TABLE `logs` (`id` int NOT NULL, PRIMARY KEY (`id`));',
            ].join('\n'),
            { dialect: 'mysql', kind: 'sql', ref: 'a' },
        );
        const to = parseDdl(
            [
                'CREATE TABLE `users` (`id` int NOT NULL, PRIMARY KEY (`id`));',
                'CREATE TABLE `orders` (`id` int NOT NULL, `user_id` int NOT NULL, `note` text, PRIMARY KEY (`id`), CONSTRAINT `o_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`));',
                'CREATE TABLE `settings` (`id` int NOT NULL, PRIMARY KEY (`id`));',
                'CREATE TABLE `logs` (`id` int NOT NULL, PRIMARY KEY (`id`));',
            ].join('\n'),
            { dialect: 'mysql', kind: 'sql', ref: 'b' },
        );
        return diffIr(from, to).diff as SchemaDiff;
    }

    it('keeps the changed table and its one foreign-key hop, and drops the rest', () => {
        const scoped = renderMermaidDiff(wideDiff(), { view: 'diff', scope: 'changed+1hop' });
        expect(scoped).toContain('orders');
        expect(scoped).toContain('users');
        expect(scoped).not.toContain('settings');
        expect(scoped).not.toContain('logs');
    });

    it('names what a scoped render dropped, so the gap is stated rather than hidden', () => {
        expect(omittedTables(wideDiff(), { view: 'diff', scope: 'changed+1hop' }).sort()).toEqual(['logs', 'settings']);
        expect(omittedTables(wideDiff(), { view: 'diff', scope: 'all' })).toEqual([]);
    });

    it('renders everything below the table threshold and scopes above it', () => {
        const d = wideDiff();
        expect(renderMermaidDiff(d, { view: 'diff' })).toContain('settings');
        expect(renderMermaidDiff(d, { view: 'diff', scopeThreshold: 2 })).not.toContain('settings');
    });

    it('never scopes a single-state view', () => {
        expect(renderMermaidDiff(wideDiff(), { view: 'current', scopeThreshold: 2 })).toContain('settings');
    });
});

describe('renderMermaidIr — a single state with no annotation', () => {
    const rendered = renderMermaidIr(current());

    it('carries no marker and no styling statement', () => {
        expect(rendered).not.toMatch(/\[[+~>-]\]/);
        expect(rendered).not.toContain('classDef');
    });

    it('carries every table and the foreign-key edge', () => {
        expect(rendered).toContain('users {');
        expect(rendered).toContain('orders {');
        expect(rendered).toContain('users ||--o{ orders');
    });
});

describe('renderChangeTable', () => {
    const rendered = renderChangeTable(diff());

    it('emits the gap-table header shape', () => {
        expect(rendered).toContain('| Object | Kind | Status | Delta | Review relevance |');
    });

    // The division of labour: the diagram has the short code, the table has the
    // delta. If the delta is not here, it is nowhere.
    it('carries the full field delta the diagram omits', () => {
        expect(rendered).toContain('type: varchar(191) → text');
        expect(rendered).toContain('on_delete: restrict → cascade');
        expect(rendered).toContain('nullable: true → false');
    });

    it('omits unchanged rows by default and includes them on request', () => {
        expect(rendered).not.toContain('`users.email`');
        expect(renderChangeTable(diff(), { includeUnchanged: true })).toContain('`users.email`');
    });

    it('states the totals and both source states', () => {
        expect(rendered).toMatch(/Totals: \d+ added · \d+ removed · \d+ modified/);
        expect(rendered).toContain('sql (static, current.sql) → sql (static, target.sql)');
    });

    // Computed from the counters, never asserted in prose.
    it('computes the scope line from the skip counters', () => {
        expect(rendered).toContain('Not represented in the current state: 1 views.');
        expect(rendered).toContain('Not represented in the target state: 1 views.');
    });

    it('points at what to review without issuing a verdict', () => {
        expect(rendered).toContain('confirm');
        expect(rendered).not.toMatch(/\bunsafe\b|\bblocked\b|\bmust not\b/i);
    });

    it('does not ask for a backfill on a column of a brand-new table', () => {
        const rows = changeRows(diff());
        const newTableColumn = rows.find((r) => r.object === 'invoices.issued_at');
        expect(newTableColumn?.relevance).toContain('new table');
        expect(newTableColumn?.relevance).not.toContain('backfill');
    });

    it('asks for a backfill on a NOT NULL column added to an existing table', () => {
        const from = parseDdl('CREATE TABLE `t` (`id` int NOT NULL, PRIMARY KEY (`id`));', {
            dialect: 'mysql',
            kind: 'sql',
            ref: 'a',
        });
        const to = parseDdl('CREATE TABLE `t` (`id` int NOT NULL, `code` varchar(4) NOT NULL, PRIMARY KEY (`id`));', {
            dialect: 'mysql',
            kind: 'sql',
            ref: 'b',
        });
        const rows = changeRows(diffIr(from, to).diff as SchemaDiff);
        expect(rows.find((r) => r.object === 't.code')?.relevance).toContain('backfill');
    });

    it('states an empty diff explicitly rather than emitting a bare header', () => {
        const same = renderChangeTable(diffIr(current(), current()).diff as SchemaDiff);
        expect(same).toContain('No structural difference between the two states.');
    });

    it('warns in the artefact when the two states came from different classes', () => {
        const introspected = { ...current(), source: { ...current().source, normalization_class: 'introspection' as const } };
        const crossed = diffIr(introspected, target(), { allowCrossSource: true }).diff as SchemaDiff;
        expect(renderChangeTable(crossed)).toContain('WARNING');
    });

    it('escapes a pipe so a delta cannot break the table', () => {
        const from = parseDdl("CREATE TABLE `t` (`c` varchar(8) NOT NULL DEFAULT 'a|b');", {
            dialect: 'mysql',
            kind: 'sql',
            ref: 'a',
        });
        const to = parseDdl("CREATE TABLE `t` (`c` varchar(8) NOT NULL DEFAULT 'c');", {
            dialect: 'mysql',
            kind: 'sql',
            ref: 'b',
        });
        const text = renderChangeTable(diffIr(from, to).diff as SchemaDiff);
        expect(text).toContain('a\\|b');
    });

    it('is byte-stable across two renders', () => {
        expect(renderChangeTable(diff())).toBe(rendered);
    });
});

describe('markerLegend', () => {
    it('explains every marker the diagram can emit', () => {
        const legend = markerLegend();
        for (const marker of ['[+]', '[-]', '[~]', '[>]']) expect(legend).toContain(marker);
    });
});

describe('the CLI', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-erd-'));
    afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

    const run = (args: string[]) => spawnSync(TSX, [SCRIPT, ...args], { encoding: 'utf8', cwd: REPO });

    it('lists all three verbs in --help and exits 0', () => {
        const r = run(['--help']);
        expect(r.status).toBe(0);
        for (const verb of ['extract', 'diff', 'render']) expect(r.stdout).toContain(verb);
    });

    it('exits 2 with usage when invoked with no verb', () => {
        expect(run([]).status).toBe(2);
    });

    it('exits 2 on an unknown verb and on an unknown source', () => {
        expect(run(['sprinkle']).status).toBe(2);
        expect(run(['extract', '--source', 'mystery', '--in', 'x']).status).toBe(2);
    });

    it('runs extract → diff → render end to end', () => {
        const cur = path.join(tmp, 'cur.json');
        const tgt = path.join(tmp, 'tgt.json');
        const d = path.join(tmp, 'diff.json');

        expect(
            run(['extract', '--source', 'sql', '--in', path.join(FIXTURES, 'current.sql'), '--out', cur, '--quiet'])
                .status,
        ).toBe(0);
        expect(
            run(['extract', '--source', 'sql', '--in', path.join(FIXTURES, 'target.sql'), '--out', tgt, '--quiet'])
                .status,
        ).toBe(0);
        expect(run(['diff', '--from', cur, '--to', tgt, '--out', d, '--quiet']).status).toBe(0);

        const rendered = run(['render', '--diff', d, '--view', 'diff', '--format', 'both']);
        expect(rendered.status).toBe(0);
        expect(rendered.stdout).toContain('```mermaid');
        expect(rendered.stdout).toContain('| Object | Kind | Status |');
        expect(rendered.stdout).toContain('[~] type');
    });

    it('exits 1 on a cross-class diff and 0 with the override', () => {
        const staticIr = path.join(tmp, 'static.json');
        const probeIr = path.join(tmp, 'probe.json');
        expect(
            run(['extract', '--source', 'sql', '--in', path.join(FIXTURES, 'current.sql'), '--out', staticIr, '--quiet'])
                .status,
        ).toBe(0);
        expect(
            run([
                'extract',
                '--source',
                'laravel-live',
                '--from-probe',
                path.join(FIXTURES, 'laravel-probe.json'),
                '--out',
                probeIr,
                '--quiet',
            ]).status,
        ).toBe(0);

        const refused = run(['diff', '--from', probeIr, '--to', staticIr, '--out', path.join(tmp, 'x.json')]);
        expect(refused.status).toBe(1);
        expect(refused.stderr).toContain('normalization-class-mix');

        const forced = run([
            'diff',
            '--from',
            probeIr,
            '--to',
            staticIr,
            '--allow-cross-source',
            '--out',
            path.join(tmp, 'y.json'),
        ]);
        expect(forced.status).toBe(0);
        expect(forced.stderr).toContain('cross-source-accepted');
    });

    it('emits findings as JSON on request', () => {
        const staticIr = path.join(tmp, 's2.json');
        const probeIr = path.join(tmp, 'p2.json');
        run(['extract', '--source', 'sql', '--in', path.join(FIXTURES, 'current.sql'), '--out', staticIr, '--quiet']);
        run([
            'extract',
            '--source',
            'laravel-live',
            '--from-probe',
            path.join(FIXTURES, 'laravel-probe.json'),
            '--out',
            probeIr,
            '--quiet',
        ]);
        const r = run(['diff', '--from', probeIr, '--to', staticIr, '--format', 'json']);
        const parsed = JSON.parse(r.stderr) as { gate_count: number; findings: { code: string }[] };
        expect(parsed.gate_count).toBe(1);
        expect(parsed.findings[0]?.code).toBe('normalization-class-mix');
    });

    it('prints the PHP probe and never opens a connection itself', () => {
        const r = run(['extract', '--source', 'laravel-live', '--emit-probe']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('getForeignKeys(');
        expect(r.stdout).toContain('json_encode');
    });

    it('refuses a laravel extract that names neither probe direction', () => {
        const r = run(['extract', '--source', 'laravel-live']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('--emit-probe');
    });

    it('rejects an unknown view, format, scope and compat value', () => {
        const d = path.join(tmp, 'diff.json');
        expect(run(['render', '--diff', d, '--view', 'sideways']).status).toBe(2);
        expect(run(['render', '--diff', d, '--format', 'interpretive-dance']).status).toBe(2);
        expect(run(['render', '--diff', d, '--scope', 'everything']).status).toBe(2);
        expect(run(['render', '--diff', d, '--compat', 'ancient']).status).toBe(2);
    });

    it('refuses to render an IR document mistaken for a diff', () => {
        const cur = path.join(tmp, 'cur.json');
        const r = run(['render', '--diff', cur]);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('is it a diff, or an IR?');
    });

    it('writes byte-identical output across two renders to a file', () => {
        const d = path.join(tmp, 'diff.json');
        const a = path.join(tmp, 'a.md');
        const b = path.join(tmp, 'b.md');
        run(['render', '--diff', d, '--out', a]);
        run(['render', '--diff', d, '--out', b]);
        expect(fs.readFileSync(a, 'utf8')).toBe(fs.readFileSync(b, 'utf8'));
    });
});
