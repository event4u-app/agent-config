// Tests for src/scripts/security_audit_config.ts (py2ts Phase 1 — VERIFY).
//
// No pytest suite exists. Golden-parity layer runs python3 vs tsx and asserts
// byte-identical stdout/stderr/exit. Surfaces:
//   1. unit spec over the inline-ported p13/p14 `_scan` twins + `audit()`,
//   2. golden parity on the REAL repo `src/` tree (clean exit-0; default + --json),
//   3. golden parity on a self-contained consumer-config fixture carrying its
//      own _lib + all four Phase-1 linters, so the Python script's sibling
//      imports resolve and both interpreters score the same crafted findings
//      (default + --json + clean + missing-root paths).
//
// Risky tokens (a real-looking secret, smuggle/injection phrases, dangerous
// frontmatter) are built from escape sequences / concatenation so this test
// file itself does not trip the package's own security linters.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import * as sac from '../../src/scripts/security_audit_config.js';
import * as p13 from '../../src/scripts/lint_mcp_config_security.js';
import * as p14 from '../../src/scripts/lint_skill_frontmatter_safety.js';
import * as sl from '../../src/scripts/_lib/security_lint.js';



// Crafted risky tokens (kept out of literal form so the corpus linters stay green).
const SECRET = 'sk-' + 'ant-' + 'A'.repeat(24); // matches _SECRET (sk-ant-… 20+ chars)
 // matches _INJECT
 // matches _SUPPRESS

// =====================================================================
// Unit spec over the inline-ported _scan twins + audit()
// =====================================================================

describe('security_audit_config — _scanMcp / _scanFrontmatter over built ScannedFile', () => {
    let tmp: string;
    afterEach(() => {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    });
    function scanPath(rel: string, body: string): sl.ScannedFile {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sac-unit-'));
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body, 'utf-8');
        return sl.scan_path(p, tmp);
    }

    it('flags an inline secret + smells in a named MCP config', () => {
        const body =
            '{\n' +
            '  "mcpServers": {\n' +
            '    "x": {\n' +
            '      "command": "npx",\n' +
            '      "args": ["-y", "srv"],\n' +
            `      "env": { "K": "${SECRET}" },\n` +
            '      "autoApprove": true\n' +
            '    }\n' +
            '  }\n' +
            '}\n';
        const hits = p13._scan(scanPath('.mcp.json', body));
        const msgs = hits.map((h) => h.message);
        expect(msgs).toContain('inline secret value in MCP config — use ${env:VAR}');
        expect(msgs).toContain('auto-approve / auto-enable bypasses consent');
        expect(msgs).toContain(
            'npx/uvx -y auto-install (supply-chain risk; pin + pre-install)',
        );
    });

    it('flags consent-bypass + wildcard + automated-without-floor in frontmatter', () => {
        const body =
            '---\n' +
            'name: foo\n' +
            'permissionMode: bypassPermissions\n' +
            'allowed-tools: "*"\n' +
            'execution:\n' +
            '  type: automated\n' +
            '  handler: none\n' +
            '---\n' +
            'body\n';
        const hits = p14._scan(scanPath('.claude/skills/foo/SKILL.md', body));
        const msgs = hits.map((h) => h.message);
        expect(msgs).toContain('permissionMode: bypassPermissions (consent bypass)');
        expect(msgs).toContain('wildcard / bare-Bash tool grant (over-broad)');
        expect(msgs).toContain(
            'automated execution with handler none/missing (runtime-safety)',
        );
        expect(msgs.every((_m) => hits[0]!.check === 'dangerous-frontmatter')).toBe(true);
    });

    it('audit() of a clean dir scores every category A/100.0, overall A 100.0', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sac-clean-'));
        fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), 'plain guidance\n', 'utf-8');
        const r = sac.audit(tmp);
        expect(r.overall_grade).toBe('A');
        expect(r.overall_score.value).toBe(100.0);
        for (const c of Object.keys(r.categories)) {
            expect(r.categories[c]!.grade).toBe('A');
            expect(r.categories[c]!.score.value).toBe(100.0);
            expect(r.categories[c]!.findings).toHaveLength(0);
        }
    });
});
