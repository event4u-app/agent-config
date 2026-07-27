// Tests for src/scripts/lint_governed_writes.ts.
//
// Fixture-based over `scanScriptsDir()` with synthetic temp-dir "scripts
// trees" (mirrors the tests/scripts/lint_framework_leakage.test.ts /
// lint_global_paths.test.ts convention), plus one real-codebase pass that
// pins the pre-registered null: the actual src/scripts/ tree scans clean.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it, afterEach, beforeEach } from 'vitest';

import { scanScriptsDir, SCRIPTS_DIR } from '../../src/scripts/lint_governed_writes.js';

function makeTree(tmp: string, files: Record<string, string>): void {
    for (const [rel, body] of Object.entries(files)) {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body, 'utf-8');
    }
}

describe('lint_governed_writes — fixture scenarios', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lgw-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('(a) a direct fs.writeFileSync(\'docs/CLAIMS.md\', …) is flagged', () => {
        makeTree(tmp, {
            'write_claims.ts': [
                "import fs from 'node:fs';",
                'export function writeClaims(content: string) {',
                "  fs.writeFileSync('docs/CLAIMS.md', content, 'utf-8');",
                '}',
                '',
            ].join('\n'),
        });

        const findings = scanScriptsDir(tmp);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.surface).toBe('claims-ledger');
        expect(findings[0]?.policy).toBe('always-forbidden');
        expect(findings[0]?.call).toBe('fs.writeFileSync');
        expect(findings[0]?.file).toBe('write_claims.ts');
    });

    it('(b) an append to an intake jsonl is NOT flagged', () => {
        makeTree(tmp, {
            'append_signal.ts': [
                "import fs from 'node:fs';",
                'export function appendSignal(line: string) {',
                "  fs.appendFileSync('agents/memory/intake/signals-2026-07.jsonl', line + '\\n', 'utf-8');",
                '}',
                '',
            ].join('\n'),
        });

        expect(scanScriptsDir(tmp)).toHaveLength(0);
    });

    it('(c) a rewrite targeting agents/memory/intake/x.jsonl IS flagged', () => {
        makeTree(tmp, {
            'rewrite_intake.ts': [
                "import fs from 'node:fs';",
                'export function rewriteIntake(content: string) {',
                "  fs.writeFileSync('agents/memory/intake/x.jsonl', content, 'utf-8');",
                '}',
                '',
            ].join('\n'),
        });

        const findings = scanScriptsDir(tmp);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.surface).toBe('memory-intake');
        expect(findings[0]?.policy).toBe('append-only');
        expect(findings[0]?.call).toBe('fs.writeFileSync');
    });

    it('a rewrite targeting agents/runtime/state/audit/ IS flagged', () => {
        makeTree(tmp, {
            'rewrite_audit.ts': [
                "import fs from 'node:fs';",
                'export function rewriteAudit(content: string) {',
                "  fs.writeFileSync('agents/runtime/state/audit/2026-07.jsonl', content, 'utf-8');",
                '}',
                '',
            ].join('\n'),
        });

        const findings = scanScriptsDir(tmp);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.surface).toBe('audit-log');
    });

    it('an append to the audit log is NOT flagged', () => {
        makeTree(tmp, {
            'append_audit.ts': [
                "import { appendFileSync } from 'node:fs';",
                'export function appendAudit(line: string) {',
                "  appendFileSync('agents/runtime/state/audit/2026-07.jsonl', line, 'utf-8');",
                '}',
                '',
            ].join('\n'),
        });

        expect(scanScriptsDir(tmp)).toHaveLength(0);
    });

    it('an fs.appendFileSync to docs/CLAIMS.md is STILL flagged (always-forbidden ignores append)', () => {
        makeTree(tmp, {
            'append_claims.ts': [
                "import fs from 'node:fs';",
                'export function appendClaims(content: string) {',
                "  fs.appendFileSync('docs/CLAIMS.md', content, 'utf-8');",
                '}',
                '',
            ].join('\n'),
        });

        const findings = scanScriptsDir(tmp);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.call).toBe('fs.appendFileSync');
    });

    it('a createWriteStream with an append flag to the audit dir is NOT flagged', () => {
        makeTree(tmp, {
            'stream_audit.ts': [
                "import fs from 'node:fs';",
                'export function streamAudit() {',
                "  return fs.createWriteStream('agents/runtime/state/audit/2026-07.jsonl', { flags: 'a' });",
                '}',
                '',
            ].join('\n'),
        });

        expect(scanScriptsDir(tmp)).toHaveLength(0);
    });

    it('a createWriteStream without an append flag to the audit dir IS flagged', () => {
        makeTree(tmp, {
            'stream_audit_rewrite.ts': [
                "import fs from 'node:fs';",
                'export function streamAudit() {',
                "  return fs.createWriteStream('agents/runtime/state/audit/2026-07.jsonl');",
                '}',
                '',
            ].join('\n'),
        });

        const findings = scanScriptsDir(tmp);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.call).toBe('fs.createWriteStream');
    });

    it('a multi-line call still resolves the literal inside the balanced-paren argument region', () => {
        makeTree(tmp, {
            'multiline_write.ts': [
                "import fs from 'node:fs';",
                'export function writeClaims(content: string) {',
                '  fs.writeFileSync(',
                "    'docs/CLAIMS.md',",
                '    content,',
                "    'utf-8',",
                '  );',
                '}',
                '',
            ].join('\n'),
        });

        expect(scanScriptsDir(tmp)).toHaveLength(1);
    });

    it('a write to an unrelated path is NOT flagged', () => {
        makeTree(tmp, {
            'unrelated.ts': [
                "import fs from 'node:fs';",
                'export function writeSomething(content: string) {',
                "  fs.writeFileSync('agents/roadmaps-progress.md', content, 'utf-8');",
                '}',
                '',
            ].join('\n'),
        });

        expect(scanScriptsDir(tmp)).toHaveLength(0);
    });

    it('a write via a variable path (no literal in the call args) is NOT flagged — known scope limit', () => {
        makeTree(tmp, {
            'indirect_write.ts': [
                "import fs from 'node:fs';",
                "const TARGET = 'docs/CLAIMS.md';",
                'export function writeClaims(content: string) {',
                '  fs.writeFileSync(TARGET, content, \'utf-8\');',
                '}',
                '',
            ].join('\n'),
        });

        expect(scanScriptsDir(tmp)).toHaveLength(0);
    });

    it('_lib/fs_atomic.ts itself is excluded from the scan', () => {
        makeTree(tmp, {
            '_lib/fs_atomic.ts': [
                "import fs from 'node:fs';",
                'export function write_atomic(p: string, data: string) {',
                "  fs.writeFileSync('docs/CLAIMS.md', data, 'utf-8');",
                '}',
                '',
            ].join('\n'),
        });

        expect(scanScriptsDir(tmp)).toHaveLength(0);
    });

    it('a *.test.ts file is excluded from the scan', () => {
        makeTree(tmp, {
            'write_claims.test.ts': [
                "import fs from 'node:fs';",
                "fs.writeFileSync('docs/CLAIMS.md', 'x', 'utf-8');",
                '',
            ].join('\n'),
        });

        expect(scanScriptsDir(tmp)).toHaveLength(0);
    });

    it('an inline lint-governed-writes-disable-next-line suppresses a real hit', () => {
        makeTree(tmp, {
            'suppressed.ts': [
                "import fs from 'node:fs';",
                'export function writeClaims(content: string) {',
                '  // lint-governed-writes-disable-next-line -- migration script, reviewed',
                "  fs.writeFileSync('docs/CLAIMS.md', content, 'utf-8');",
                '}',
                '',
            ].join('\n'),
        });

        expect(scanScriptsDir(tmp)).toHaveLength(0);
    });
});

// --- Real-codebase scan --------------------------------------------------
describe('lint_governed_writes — real repo scan', () => {
    it('(d) the pre-registered null: today\'s src/scripts/ tree scans clean', () => {
        const findings = scanScriptsDir(SCRIPTS_DIR);
        if (findings.length > 0) {
            // Surface exactly what tripped it — never a silent skip.
            // eslint-disable-next-line no-console
            console.error('lint_governed_writes real-scan findings:', findings);
        }
        expect(findings).toHaveLength(0);
    });
});
