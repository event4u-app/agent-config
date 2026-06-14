// P1.3 — MCP-config security linter (road-to-security-pillar.md). OWASP ASI04.
//
// TypeScript twin of `src/scripts/lint_mcp_config_security.py` (ADR-096 —
// Python→TS migration). Behaviour mirrors the Python module byte-for-byte.
//
// Scans shipped MCP configuration — named config files (`*.mcp.json`,
// `mcp.json`, `claude_desktop_config.json*`) and fenced ```json blocks that
// declare `mcpServers` — for the supply-chain smells behind MCP tool-poisoning
// and rug-pull attacks.
//
// - HIGH (fail): a **real inline secret value** in a shipped config (an actual
//   key, not the bare prefix used as documentation). Secrets belong in
//   `${env:VAR}`.
// - MED (warn): `npx -y` auto-install, unpinned server version, `autoApprove`
//   / `enableAllProjectMcpServers`, `0.0.0.0` binding, shell metacharacters in
//   args, omnibus scopes (`*` / `all` / `full-access`), `*_BASE_URL` in a
//   project-scoped env. These are smells, not leaks — templates legitimately
//   show them, so they warn (and weight 0.25x in example/template files per P1.5).
//
// Usage: ./scripts-run src/scripts/lint_mcp_config_security [--json]

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as sl from './_lib/security_lint.js';

export const CHECK = 'mcp-config-security';

//   Python: re.compile(r"(^|/)(\.mcp\.json|mcp\.json|claude_desktop_config\.json)")
const _NAME_HINTS = /(^|\/)(\.mcp\.json|mcp\.json|claude_desktop_config\.json)/;

// Real secret VALUES (prefix + enough key chars to be a live credential).
//   Python (no flags):
const _SECRET = new RegExp(
    'sk-ant-[A-Za-z0-9_\\-]{20,}' +
        '|sk-proj-[A-Za-z0-9_\\-]{20,}' +
        '|AKIA[0-9A-Z]{16}' +
        '|AIza[0-9A-Za-z_\\-]{35}' +
        '|ghp_[0-9A-Za-z]{36}' +
        '|eyJ[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}',
);

// Line-level smells (match on a single line).
const _MED: ReadonlyArray<[RegExp, string]> = [
    [
        /\bautoApprove\b|\benableAllProjectMcpServers\b/i,
        'auto-approve / auto-enable bypasses consent',
    ],
    [/0\.0\.0\.0/, '0.0.0.0 bind (exposed beyond localhost)'],
    [/"[^"]*_BASE_URL"\s*:/, '*_BASE_URL in config (request-redirect / token-exfil vector)'],
    [
        /"(scopes?|permissions?)"\s*:\s*(\[[^\]]*"(\*|all|full-access)"|"(\*|all|full-access)")/i,
        'omnibus scope (* / all / full-access)',
    ],
    [/"args"\s*:\s*\[[^\]]*(&&|\|\||;|`)/, 'shell metacharacters in args'],
];
// Chunk-level smells (span multiple lines in pretty-printed JSON).
const _NPX = /"command"\s*:\s*"(npx|uvx)"/i;
const _NPX_YES = /"\s*(-y|--yes)\s*"/;

//   Python: re.match(r"`{3,}(json[c5]?|jsonc)\b", st)
const _FENCE_OPEN = /^`{3,}(json[c5]?|jsonc)\b/;
//   Python: re.match(r"`{3,}\s*$", st)
const _FENCE_CLOSE = /^`{3,}\s*$/;

/** Yield [start_lineno, [[lineno, text], ...]] for MCP-config regions in this file. */
function* _candidate_chunks(sf: sl.ScannedFile): Generator<[number, Array<[number, string]>]> {
    if (_NAME_HINTS.test(sf.rel)) {
        const numbered: Array<[number, string]> = sf.lines.map(
            (t, i) => [i + 1, t] as [number, string],
        );
        yield [1, numbered];
        return;
    }
    // sf.path.suffix != ".md" — mirror pathlib `.suffix`.
    if (_suffix(sf.path) !== '.md') {
        return;
    }
    // fenced ```json / ```jsonc blocks that mention mcpServers / command
    let in_block = false;
    let start = 0;
    let buf: Array<[number, string]> = [];
    for (let idx = 0; idx < sf.lines.length; idx++) {
        const i = idx + 1;
        const text = sf.lines[idx] as string;
        const st = text.trim();
        if (!in_block && _FENCE_OPEN.test(st)) {
            in_block = true;
            start = i;
            buf = [];
            continue;
        }
        if (in_block && _FENCE_CLOSE.test(st)) {
            const joined = buf.map(([, t]) => t).join('\n');
            if (joined.includes('mcpServers') || joined.includes('"command"')) {
                yield [start, buf];
            }
            in_block = false;
            buf = [];
            continue;
        }
        if (in_block) {
            buf.push([i, text]);
        }
    }
}

/** Mirror pathlib `PurePath.suffix` for the final path component. */
function _suffix(p: string): string {
    const base = p.split('/').join(path.sep).split(path.sep).pop() ?? '';
    // Path.suffix: '' if name has no '.', or starts with '.' and has no other dot.
    const dot = base.lastIndexOf('.');
    if (dot <= 0) {
        return '';
    }
    return base.slice(dot);
}

export function _scan(sf: sl.ScannedFile): sl.Finding[] {
    if (sf.pragma_allows(CHECK)) {
        return [];
    }
    const out: sl.Finding[] = [];
    for (const [start, numbered] of _candidate_chunks(sf)) {
        for (const [lineno, text] of numbered) {
            if (_SECRET.test(text)) {
                out.push(
                    new sl.Finding(
                        sf.rel,
                        lineno,
                        CHECK,
                        'HIGH',
                        'inline secret value in MCP config — use ${env:VAR}',
                        sf.weight,
                    ),
                );
            }
            for (const [rx, label] of _MED) {
                if (rx.test(text)) {
                    out.push(new sl.Finding(sf.rel, lineno, CHECK, 'MED', label, sf.weight));
                }
            }
        }
        // chunk-level: npx/uvx auto-install spans command + args lines
        // Python: next((ln for ln, t in numbered if _NPX.search(t)), start)
        let npx_line = start;
        for (const [ln, t] of numbered) {
            if (_NPX.test(t)) {
                npx_line = ln;
                break;
            }
        }
        const chunk = numbered.map(([, t]) => t).join('\n');
        if (_NPX.test(chunk) && _NPX_YES.test(chunk)) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    npx_line,
                    CHECK,
                    'MED',
                    'npx/uvx -y auto-install (supply-chain risk; pin + pre-install)',
                    sf.weight,
                ),
            );
        }
    }
    return out;
}

interface Args {
    json: boolean;
}

function _argError(msg: string): never {
    process.stderr.write('usage: lint_mcp_config_security [-h] [--json]\n');
    process.stderr.write(`lint_mcp_config_security: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): Args {
    const out: Args = { json: false };
    const extra: string[] = [];
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_mcp_config_security [-h] [--json]\n');
            process.exit(0);
        } else if (a === '--json') {
            out.json = true;
        } else {
            extra.push(a);
        }
    }
    if (extra.length > 0) {
        _argError(`unrecognized arguments: ${extra.join(' ')}`);
    }
    return out;
}

export function main(argv: readonly string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const findings: sl.Finding[] = [];
    // scan .md (fenced examples) under the default roots PLUS named MCP configs
    // under src/templates (where the shipped claude_desktop_config template lives).
    const roots = [...sl.DEFAULT_SCAN_ROOTS, 'src/templates'];
    for (const sf of sl.iter_corpus(roots, ['.md', '.json', '.template'])) {
        for (const h of _scan(sf)) {
            findings.push(h);
        }
    }

    if (args.json) {
        const payload = sl.py_json_dumps_indent2(findings.map((f) => f.toDict()));
        process.stdout.write(payload + '\n');
        return findings.some((f) => f.is_fail) ? 1 : 0;
    }
    return sl.report(findings, { check_label: 'mcp-config-security' });
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exitCode = main();
}
