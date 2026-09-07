#!/usr/bin/env tsx
/**
 * The documented MCP client snippets must match the entry the installer writes.
 *
 * `docs/mcp-server.md` documented an absolute `tsx` path in four snippets while
 * the installer wrote an `npx` invocation, so a consumer who followed the docs
 * and a consumer who ran the installer landed on two different servers — for
 * long enough that nobody noticed either was wrong.
 *
 * Scope is two literals in this tree. It asserts NOTHING about host behaviour:
 * that a host reads the file at all is a separate question this gate does not
 * touch and must not be cited for.
 *
 * Exit codes: 0 in sync · 1 drift · 2 a source is missing or unreadable.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { MCP_PACKAGE_NAME, MCP_SERVER_KEY, mcpBridgeEntry } from './_lib/mcp_bridge.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DOC_REL = 'docs/mcp-server.md';

/**
 * A snippet is any fenced block naming our server key.
 *
 * Deliberately not a JSON/YAML parse: the four documented clients use three
 * different shapes (`command` as a string, `command` as an object with `path`,
 * and a YAML list), and a parser per shape would drift from the docs as surely
 * as the docs drifted from the installer. The two facts that matter — the
 * runner and the package spec — are the same literals in all three.
 */
export function snippetBlocks(text: string): string[] {
    const out: string[] = [];
    const lines = text.split('\n');
    let open: string[] | null = null;
    for (const line of lines) {
        if (line.startsWith('```')) {
            if (open === null) open = [];
            else {
                const body = open.join('\n');
                if (body.includes(MCP_SERVER_KEY) || body.includes('mcpServers')) out.push(body);
                open = null;
            }
            continue;
        }
        if (open !== null) open.push(line);
    }
    return out;
}

export interface DocFinding {
    snippet: number;
    reason: string;
}

export function checkSnippets(text: string, packageRoot: string): DocFinding[] {
    const server = (mcpBridgeEntry(packageRoot)['mcpServers'] as Record<string, unknown>)[
        MCP_SERVER_KEY
    ] as { command: string; args: string[] };
    const findings: DocFinding[] = [];

    snippetBlocks(text).forEach((body, i) => {
        // Only blocks that actually configure the server — a block that merely
        // mentions `mcpServers` in prose is not a client configuration.
        if (!body.includes('command')) return;
        if (!body.includes(server.command)) {
            findings.push({
                snippet: i + 1,
                reason: `does not use the installer's runner \`${server.command}\``,
            });
        }
        if (!body.includes(MCP_PACKAGE_NAME)) {
            findings.push({
                snippet: i + 1,
                reason: `does not name the package \`${MCP_PACKAGE_NAME}\``,
            });
        }
        // QUOTED, not a substring: `mcp-server` contains `serve`, so a plain
        // `includes` reported a snippet as current after the entry had been
        // changed to `serve` and the doc had not — measured, on this gate's own
        // sensitivity probe. Every documented shape quotes the token.
        const subcommand = server.args[server.args.length - 1] as string;
        if (!body.includes(`"${subcommand}"`)) {
            findings.push({
                snippet: i + 1,
                reason: `does not invoke \`${subcommand}\``,
            });
        }
        if (body.includes('node_modules/.bin/tsx')) {
            findings.push({
                snippet: i + 1,
                reason: 'documents an absolute tsx path the installer never writes',
            });
        }
    });
    return findings;
}

function main(): number {
    if (process.argv.slice(2).includes('--self-test')) return selfTest();
    const rootIdx = process.argv.indexOf('--root');
    const root = rootIdx === -1 ? ROOT : (process.argv[rootIdx + 1] ?? ROOT);
    const doc = path.join(root, DOC_REL);
    if (!fs.existsSync(doc)) {
        process.stderr.write(`❌  ${DOC_REL} not found under ${root}\n`);
        return 2;
    }
    const text = fs.readFileSync(doc, 'utf-8');
    const blocks = snippetBlocks(text).filter((b) => b.includes('command'));
    const findings = checkSnippets(text, root);

    reportScanned({
        gate: 'check_mcp_doc_drift',
        scanned: blocks.length,
        units: 'documented client snippet(s)',
        roots: [DOC_REL],
    });

    if (findings.length > 0) {
        for (const f of findings) {
            process.stdout.write(`❌  ${DOC_REL} snippet ${String(f.snippet)}: ${f.reason}\n`);
        }
        process.stdout.write(
            `\n${String(findings.length)} finding(s). The documented entry and the entry ` +
                '`mcpBridgeEntry()` writes have drifted apart.\n',
        );
        return 1;
    }
    process.stdout.write(
        `✅  check_mcp_doc_drift: ${String(blocks.length)} documented snippet(s) match the ` +
            'installer entry.\n',
    );
    return 0;
}

/** One rejecting case per way the two literals can drift. */
function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doc-drift-'));
    const write = (name: string, doc: string): string => {
        const dir = path.join(tmp, name);
        fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
        fs.writeFileSync(path.join(dir, DOC_REL), doc, 'utf-8');
        return dir;
    };
    const run = (root: string): number =>
        runGateCli(ROOT, 'src/scripts/check_mcp_doc_drift.ts', ['--root', root], root);

    const good = [
        '```json',
        '{ "mcpServers": { "agent-config": {',
        '  "command": "npx",',
        '  "args": ["-y", "@event4u/agent-config@<version>", "mcp-server"] } } }',
        '```',
        '',
    ].join('\n');
    const tsxPath = good.replace('"npx"', '"/abs/agent-config/node_modules/.bin/tsx"');
    const noPackage = good.replace('@event4u/agent-config@<version>', 'some-other-package');
    const noSubcommand = good.replace('"mcp-server"', '"serve"');

    try {
        return runSelfTest({
            gate: 'check_mcp_doc_drift',
            minCases: 4,
            minRejectCases: 3,
            cases: [
                {
                    name: 'an absolute tsx path is rejected',
                    expect: 'reject',
                    run: () => run(write('tsx', tsxPath)),
                },
                {
                    name: 'a snippet naming another package is rejected',
                    expect: 'reject',
                    run: () => run(write('pkg', noPackage)),
                },
                {
                    name: 'a snippet invoking another subcommand is rejected',
                    expect: 'reject',
                    run: () => run(write('sub', noSubcommand)),
                },
                {
                    name: 'the installer-shaped snippet passes',
                    expect: 'accept',
                    run: () => run(write('good', good)),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { DOC_REL, main };
