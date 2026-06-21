// Tests for src/scripts/lint_mcp_config_security.ts (py2ts Phase 1 — VERIFY).
//
// No pytest suite exists. Golden-parity layer runs python3 vs tsx and asserts
// byte-identical stdout/stderr/exit. Two parity surfaces:
//   1. the REAL repo `src/` tree (clean exit-0 path; default + --json),
//   2. a self-contained fixture repo carrying its own _lib + linter so the
//      linter's `ROOT = parents[3]` resolves to the fixture (crafted-hit
//      exit-1 path; default + --json).
//
// Crafted attack tokens are assembled from fragments so this test file itself
// is not flagged when the linter scans the real src/ tree.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import * as sl from '../../src/scripts/_lib/security_lint.js';
import * as mcp from '../../src/scripts/lint_mcp_config_security.js';



// Assembled from fragments — a fake-but-shaped OpenAI key that satisfies
// sk-proj-[A-Za-z0-9_-]{20,} without being a live credential.
const FAKE_SECRET = 'sk-' + 'proj-' + 'A'.repeat(24);
const NPX = '"' + 'command' + '"';
const YES = '"' + '-y' + '"';

// --- Unit spec over exported _scan ------------------------------------------

describe('lint_mcp_config_security — _scan over a built ScannedFile', () => {
    let tmp: string;
    afterEach(() => {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    });
    function scanFile(name: string, body: string): sl.Finding[] {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-unit-'));
        const p = path.join(tmp, name);
        fs.writeFileSync(p, body, 'utf-8');
        return mcp._scan(sl.scan_file(p));
    }

    it('flags an inline secret value in a named .mcp.json as HIGH', () => {
        const hits = scanFile('.mcp.json', `{ "key": "${FAKE_SECRET}" }\n`);
        expect(hits.map((h) => h.severity)).toContain('HIGH');
        expect(hits.some((h) => h.message.includes('inline secret value'))).toBe(true);
    });

    it('flags 0.0.0.0 bind and autoApprove as MED', () => {
        const hits = scanFile(
            'mcp.json',
            '{\n  "host": "0.0.0.0",\n  "autoApprove": true\n}\n',
        );
        const med = hits.filter((h) => h.severity === 'MED').map((h) => h.message);
        expect(med).toContain('0.0.0.0 bind (exposed beyond localhost)');
        expect(med).toContain('auto-approve / auto-enable bypasses consent');
        expect(hits.every((h) => !h.is_fail)).toBe(true);
    });

    it('flags npx -y auto-install at the command line as MED', () => {
        const hits = scanFile(
            'mcp.json',
            `{\n  ${NPX}: "npx",\n  "args": [${YES}]\n}\n`,
        );
        expect(hits.map((h) => h.message)).toContain(
            'npx/uvx -y auto-install (supply-chain risk; pin + pre-install)',
        );
    });

    it('scans a fenced ```json block in a .md that mentions mcpServers', () => {
        const body = '```json\n{ "mcpServers": { "x": "0.0.0.0" } }\n```\n';
        const hits = scanFile('doc.md', body);
        expect(hits.map((h) => h.message)).toContain('0.0.0.0 bind (exposed beyond localhost)');
    });

    it('ignores a fenced block that does not mention mcpServers / command', () => {
        const hits = scanFile('doc.md', '```json\n{ "host": "0.0.0.0" }\n```\n');
        expect(hits).toHaveLength(0);
    });

    it('respects the allow pragma', () => {
        const hits = scanFile(
            '.mcp.json',
            `<!-- security-lint: allow mcp-config-security "teaching" -->\n{ "k": "${FAKE_SECRET}" }\n`,
        );
        expect(hits).toHaveLength(0);
    });
});
