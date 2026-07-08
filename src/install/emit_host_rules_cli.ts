#!/usr/bin/env tsx
/**
 * Consumer host-native rule emission
 * (road-to-request-scoped-rule-load Phase 1b Step 3).
 *
 * Before this CLI, consumer Cursor got a symlink farm to raw `.md` (no
 * `.mdc`, no auto-attach globs) and consumer `.windsurfrules` was built by
 * a bash concatenator that STRIPPED all frontmatter — destroying the
 * host-native trigger signal Phase 2 added to the projection path.
 *
 * ## Recorded decision — install-time emission, not dist artifacts
 *
 * Phase 1b Step 3 asked for one recorded choice: pre-built host artifacts
 * in `dist/` vs emission at install time. Decision: INSTALL-TIME EMISSION,
 * re-using the exported condense emitters (`_emit_cursor_mdc`,
 * `_emit_windsurf_rule`, `strip_frontmatter`) verbatim. Rationale:
 *   - a new `dist/agent-src/hosts/` tree would cascade through the
 *     discovery manifest, artefact checksums, condensation hashes and the
 *     always-budget gates for what is derived data;
 *   - dist artifacts are scope-agnostic — install-time emission runs AFTER
 *     the Phase-1b rule filter, so scoped installs get scoped host files
 *     for free;
 *   - re-using the exported emitters keeps consumer output byte-identical
 *     to the maintainer projection (Pipeline B never drifts from A).
 * The trade-off (node required at install time) matches the rule-scope
 * resolver: no node → install.sh keeps its legacy fallback surfaces.
 *
 * Usage:
 *   emit_host_rules_cli.ts --rules-dir <installed rules dir>
 *                          --project-root <consumer root>
 *                          --tools cursor,windsurf
 *
 * Exit codes: 0 emitted · 2 usage error · 1 emission failure (caller falls
 * back to the legacy surface).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    _emit_cursor_mdc,
    _emit_windsurf_rule,
    strip_frontmatter,
} from '../scripts/condense.js';

function _ruleFiles(rulesDir: string): string[] {
    return fs
        .readdirSync(rulesDir)
        .filter((n) => n.endsWith('.md'))
        .sort()
        .map((n) => path.join(rulesDir, n))
        .filter((p) => {
            try {
                return fs.statSync(p).isFile();
            } catch {
                return false;
            }
        });
}

/** Remove entries not in `valid` (mirror of condense's `_clean_modern_dir`). */
function _cleanDir(dir: string, valid: ReadonlySet<string>): void {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return;
    }
    for (const name of entries) {
        if (name === 'README.md' || valid.has(name)) {
            continue;
        }
        const full = path.join(dir, name);
        try {
            if (fs.lstatSync(full).isDirectory()) {
                fs.rmSync(full, { recursive: true, force: true });
            } else {
                fs.unlinkSync(full);
            }
        } catch {
            /* best-effort clean */
        }
    }
}

export function emitCursor(rulesDir: string, projectRoot: string): number {
    const targetDir = path.join(projectRoot, '.cursor', 'rules');
    const files = _ruleFiles(rulesDir);
    const valid = new Set<string>();
    for (const src of files) {
        const name = `${path.basename(src, '.md')}.mdc`;
        _emit_cursor_mdc(src, path.join(targetDir, name));
        valid.add(name);
    }
    _cleanDir(targetDir, valid);
    return files.length;
}

export function emitWindsurf(rulesDir: string, projectRoot: string): number {
    const perRuleDir = path.join(projectRoot, '.windsurf', 'rules');
    const files = _ruleFiles(rulesDir);
    const valid = new Set<string>();
    for (const src of files) {
        const name = path.basename(src);
        _emit_windsurf_rule(src, path.join(perRuleDir, name));
        valid.add(name);
    }
    _cleanDir(perRuleDir, valid);

    // Concatenated legacy surface — same format as the projection-path
    // generator (condense.generate_windsurfrules), consumer-sourced header.
    const parts = ['# Auto-generated from .augment/rules/ — do not edit directly\n'];
    for (const src of files) {
        const content = strip_frontmatter(fs.readFileSync(src, 'utf-8'));
        parts.push(`---\n\n${content.trim()}\n`);
    }
    fs.writeFileSync(path.join(projectRoot, '.windsurfrules'), parts.join('\n') + '\n', 'utf-8');
    return files.length;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let rulesDir = '';
    let projectRoot = '';
    let tools: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--rules-dir') {
            rulesDir = argv[i + 1] ?? '';
            i += 1;
        } else if (arg === '--project-root') {
            projectRoot = argv[i + 1] ?? '';
            i += 1;
        } else if (arg === '--tools') {
            tools = (argv[i + 1] ?? '').split(',').filter((t) => t.length > 0);
            i += 1;
        } else {
            process.stderr.write(`emit_host_rules_cli: unknown argument: ${arg}\n`);
            return 2;
        }
    }
    if (rulesDir === '' || projectRoot === '' || tools.length === 0) {
        process.stderr.write(
            'usage: emit_host_rules_cli.ts --rules-dir <dir> --project-root <dir> --tools cursor,windsurf\n',
        );
        return 2;
    }
    if (!fs.existsSync(rulesDir)) {
        process.stderr.write(`emit_host_rules_cli: rules dir not found: ${rulesDir}\n`);
        return 1;
    }
    try {
        for (const tool of tools) {
            if (tool === 'cursor') {
                const n = emitCursor(rulesDir, path.resolve(projectRoot));
                process.stdout.write(`cursor: ${n} .mdc rule(s)\n`);
            } else if (tool === 'windsurf') {
                const n = emitWindsurf(rulesDir, path.resolve(projectRoot));
                process.stdout.write(`windsurf: ${n} rule(s) + .windsurfrules\n`);
            } else {
                process.stderr.write(`emit_host_rules_cli: unknown tool: ${tool}\n`);
                return 2;
            }
        }
        return 0;
    } catch (e) {
        process.stderr.write(
            `emit_host_rules_cli: emission failed: ${e instanceof Error ? e.message : String(e)}\n`,
        );
        return 1;
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
