#!/usr/bin/env tsx
/**
 * lint_pre_migration_refs — no pre-migration install hints in shipped files.
 *
 * road-to-credible-install Phase 0 (doc-rot sweep): the 9.8.0 external review
 * found live docs still instructing consumers to run the retired Python
 * installer (`scripts/install.py`, deleted in ADR-200) and to
 * `pip install agent-config[mcp]`. This lint pins the count at zero and
 * keeps it there.
 *
 * Scope: every git-tracked file covered by the package.json `files`
 * whitelist (the published surface), because that is exactly what an
 * external evaluator reads.
 *
 * Patterns (instructional hints only — NOT every mention of the string;
 * legacy-install *detection/cleanup* code legitimately names old artifacts):
 *   - `pip install agent-config`            (any variant)
 *   - `python[3] ... install.py`            (a runnable command)
 *   - backtick-quoted `scripts/install.py`  (presented as a current path)
 *   - `python -m scripts.mcp_server`        (retired Python MCP entry)
 *
 * Carve-outs (historical records, allowed to name retired things):
 *   - CHANGELOG.md, MIGRATION.md
 *   - this lint itself
 *
 * Exit codes: 0 clean · 1 findings · 2 internal error.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const PATTERNS: readonly { re: RegExp; label: string }[] = [
    { re: /pip install agent-config/, label: 'pip install hint (Python package retired, ADR-200)' },
    { re: /python3?\s+\S*install\.py\b/, label: 'python install.py invocation (retired, ADR-200)' },
    { re: /`scripts\/install\.py`/, label: 'scripts/install.py cited as a current path (retired, ADR-200)' },
    { re: /python3?\s+-m\s+scripts\.mcp_server/, label: 'python -m scripts.mcp_server (retired MCP entry, ADR-200)' },
];

const CARVE_OUTS = new Set(['CHANGELOG.md', 'MIGRATION.md', 'src/scripts/lint_pre_migration_refs.ts']);

/** Binary-ish extensions we never scan. */
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.wasm', '.zip', '.gz', '.pdf']);

function shippedTrackedFiles(): string[] {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')) as {
        files?: string[];
    };
    const files = pkg.files ?? [];
    const prefixes = files.filter((f) => f.endsWith('/')).map((f) => f.replace(/\/+$/, '') + '/');
    const exact = new Set(files.filter((f) => !f.endsWith('/')));
    const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf-8' })
        .split('\n')
        .filter(Boolean);
    return tracked.filter((t) => exact.has(t) || prefixes.some((p) => t.startsWith(p)));
}

export function scanText(relPath: string, text: string): string[] {
    const findings: string[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        for (const { re, label } of PATTERNS) {
            if (re.test(lines[i] as string)) {
                findings.push(`${relPath}:${i + 1}: ${label}`);
            }
        }
    }
    return findings;
}

export function main(): number {
    const findings: string[] = [];
    for (const rel of shippedTrackedFiles()) {
        if (CARVE_OUTS.has(rel)) continue;
        if (SKIP_EXT.has(path.extname(rel))) continue;
        const abs = path.join(REPO_ROOT, rel);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf-8');
        } catch {
            continue;
        }
        findings.push(...scanText(rel, text));
    }
    if (findings.length > 0) {
        for (const f of findings) {
            process.stderr.write(`❌  pre-migration reference: ${f}\n`);
        }
        process.stderr.write(
            `\n${findings.length} pre-migration reference(s) in shipped files. ` +
                'The Python installer / pip package is retired (ADR-200) — update the hint ' +
                'to the TypeScript path (scripts/install.ts, `npx -y @event4u/agent-config …`).\n',
        );
        return 1;
    }
    process.stdout.write('✅  no pre-migration install hints in shipped files\n');
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
