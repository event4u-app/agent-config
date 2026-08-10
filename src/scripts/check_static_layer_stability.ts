#!/usr/bin/env node
/**
 * Static-layer stability lint (road-to-token-economy-cache Phase 2.2 — the
 * hygiene half the Phase-1 null left standing; spike note:
 * agents/settings/contexts/cache-injection-anatomy.md).
 *
 * The always-loaded layer is re-sent on every session and every spawn; a
 * MACHINE-VOLATILE marker inside it (an absolute local path naming a real
 * user, a session/run-id shape) is both a cache-stability hazard and a
 * portability leak. Scope is deliberately NARROW and honest:
 *
 *   - scanned: dist/agent-src/rules/*.md EXCLUDING the kernel set (the
 *     kernel prefix has its own byte-drift guard,
 *     check_kernel_prefix_stability — no double coverage, roadmap Risk 8)
 *   - flagged: absolute home paths (/Users/<name>/, /home/<name>/,
 *     C:\Users\<name>\) and UUID-shaped run/session ids
 *   - NOT flagged: dates in prose (stable content, not build-volatile) —
 *     build-time volatility is already impossible for .md by the ADR-201
 *     byte-exact projection (dist == rewrite(src)); this lint catches what
 *     an AUTHOR pastes, which the projection faithfully preserves.
 *
 * Exit 0 green · 1 findings · 2 unusable. Dead-scope guarded via
 * assertScanned. Self-test: tests/scripts/check_static_layer_stability.test.ts
 * proves red on a fixture carrying a home path and a UUID.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _IN_BUNDLE = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ...(_IN_BUNDLE ? ['..'] : ['..', '..']),
);
const RULES_DIR = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');
const ROUTER = path.join(REPO_ROOT, 'dist', 'router.json');

/** Machine-volatile shapes. Home paths anchor on the OS home prefix; the
 *  UUID shape requires all five groups so ordinary hex constants stay quiet. */
const HOME_PATH_RE = /(?:\/(?:Users|home)\/[A-Za-z][\w.-]*\/|[A-Za-z]:\\Users\\[A-Za-z][\w.-]*\\)/;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
/** Per-line opt-out for a deliberate, justified exception. */
const IGNORE_MARKER = 'static-layer-allow';

export interface Finding {
    file: string;
    line: number;
    kind: 'home-path' | 'uuid';
    excerpt: string;
}

function kernelBasenames(routerPath: string): Set<string> {
    try {
        const router = JSON.parse(fs.readFileSync(routerPath, 'utf8')) as { kernel?: unknown };
        if (Array.isArray(router.kernel)) {
            return new Set(
                router.kernel
                    .filter((k): k is string => typeof k === 'string')
                    .map((k) => (k.endsWith('.md') ? k : `${k}.md`)),
            );
        }
    } catch {
        /* fall through — an unreadable router means we scan everything (fail toward coverage) */
    }
    return new Set();
}

export function scan(opts: { rulesDir?: string; routerPath?: string } = {}): { findings: Finding[]; scanned: number } {
    const rulesDir = opts.rulesDir ?? RULES_DIR;
    const kernel = kernelBasenames(opts.routerPath ?? ROUTER);
    const findings: Finding[] = [];
    let scanned = 0;
    const files = fs.existsSync(rulesDir) ? fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md')) : [];
    for (const f of files) {
        if (kernel.has(f)) continue; // kernel prefix has its own drift guard
        scanned += 1;
        const text = fs.readFileSync(path.join(rulesDir, f), 'utf8');
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? '';
            if (line.includes(IGNORE_MARKER)) continue;
            if (HOME_PATH_RE.test(line)) {
                findings.push({ file: f, line: i + 1, kind: 'home-path', excerpt: line.trim().slice(0, 120) });
            } else if (UUID_RE.test(line)) {
                findings.push({ file: f, line: i + 1, kind: 'uuid', excerpt: line.trim().slice(0, 120) });
            }
        }
    }
    return { findings, scanned };
}

export function main(argv: readonly string[]): number {
    let rulesDir: string | undefined;
    let routerPath: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--rules-dir') rulesDir = argv[++i];
        else if (argv[i] === '--router') routerPath = argv[++i];
    }
    const opts: Parameters<typeof scan>[0] = {
        ...(rulesDir !== undefined ? { rulesDir } : {}),
        ...(routerPath !== undefined ? { routerPath } : {}),
    };
    let result: ReturnType<typeof scan>;
    try {
        result = scan(opts);
    } catch (err) {
        process.stderr.write(`check_static_layer_stability: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    try {
        assertScanned({
            gate: 'check_static_layer_stability',
            scanned: result.scanned,
            units: 'non-kernel always-loaded rule file(s)',
            roots: [rulesDir ?? RULES_DIR],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    for (const f of result.findings) {
        process.stderr.write(
            `❌  ${f.file}:${f.line} — ${f.kind} in the always-loaded layer (machine-volatile marker; re-sent on every spawn): ${f.excerpt}\n`,
        );
    }
    if (result.findings.length > 0) {
        process.stderr.write(
            `check_static_layer_stability: ${result.findings.length} finding(s) across ${result.scanned} scanned file(s). ` +
                `A deliberate exception carries '${IGNORE_MARKER}' on the line with its reason.\n`,
        );
        return 1;
    }
    process.stdout.write(`✅  check_static_layer_stability: ${result.scanned} non-kernel always-loaded file(s) clean\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (_IN_BUNDLE) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main(process.argv.slice(2)));
