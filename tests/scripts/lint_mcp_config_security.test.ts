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

    it('still catches every shape the retired local regex caught, now through the shared rule table', () => {
        const a = 'abcdefghijklmnopqrstuvwxyz0123456789ABCD';
        const shapes: Record<string, string> = {
            'sk-ant': 'sk-' + 'ant-api03-' + a + a,
            'sk-proj': FAKE_SECRET,
            AKIA: 'AKIA' + 'QWERTYUIOPASDFGH',
            AIza: 'AIza' + 'SyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW',
            ghp_: 'ghp' + '_aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1dE3fG5',
            JWT: 'eyJ' + 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        };
        for (const [name, value] of Object.entries(shapes)) {
            expect(mcp.hasInlineSecret(`{ "env": { "TOKEN": "${value}" } }`), name).toBe(true);
        }
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

    it('respects an UNBOUND allow pragma, and reports it as legacy-pragma', () => {
        const hits = scanFile(
            '.mcp.json',
            `<!-- security-lint: allow mcp-config-security "teaching" -->\n{ "k": "${FAKE_SECRET}" }\n`,
        );
        expect(hits.filter((h) => h.check === 'mcp-config-security')).toHaveLength(0);
        expect(hits.map((h) => h.check)).toEqual([sl.LEGACY_PRAGMA_CHECK]);
        expect(hits[0]!.is_fail).toBe(false);
    });

    // road-to-a-link-with-agent-switch 4.2: switch_decide records the user's
    // answer, so the host must confirm every call. An auto-allow entry for it —
    // by name, or for the whole agent-switch server — fails.
    describe('switch_decide is never auto-allowed', () => {
        const DECIDE = 'switch' + '_decide';
        const SERVER = 'mcp__' + 'agent-switch';
        const decideHits = (hits: sl.Finding[]): sl.Finding[] => hits.filter((h) => h.message.includes(DECIDE));

        it.each([
            ['an autoApprove list in .mcp.json', '.mcp.json', `{ "mcpServers": { "agent-switch": { "command": "agent-switch", "autoApprove": ["${DECIDE}"] } } }\n`],
            ['an alwaysAllow list', '.mcp.json', `{ "mcpServers": { "agent-switch": {\n  "alwaysAllow": [\n    "${DECIDE}"\n  ] } } }\n`],
            ['a Claude permission allow for the tool', '.claude/settings.json', `{ "permissions": { "allow": ["${SERVER}__${DECIDE}"] } }\n`],
            ['a Claude permission allow for the whole server', '.claude/settings.json', `{ "permissions": { "allow": ["${SERVER}"] } }\n`],
            ['a wildcard over the server', '.claude/settings.local.json', `{ "permissions": { "allow": ["${SERVER}__*"] } }\n`],
        ])('%s fails as HIGH', (_label, name, body) => {
            fs.mkdirSync(path.dirname(path.join((tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-decide-'))), name)), { recursive: true });
            const p = path.join(tmp, name);
            fs.writeFileSync(p, body, 'utf-8');
            const hits = decideHits(mcp._scan(sl.scan_file(p)));
            expect(hits).toHaveLength(1);
            expect(hits[0]!.severity).toBe('HIGH');
            expect(hits[0]!.is_fail).toBe(true);
        });

        it('the server entry itself, a deny, and other tools on an allow list do not', () => {
            expect(decideHits(scanFile('.mcp.json', `{ "mcpServers": { "agent-switch": { "command": "agent-switch", "args": ["mcp", "serve"] } } }\n`))).toEqual([]);
            fs.rmSync(tmp, { recursive: true, force: true });
            expect(decideHits(scanFile('settings.json', `{ "permissions": { "deny": ["${SERVER}__${DECIDE}"] } }\n`))).toEqual([]);
            fs.rmSync(tmp, { recursive: true, force: true });
            expect(decideHits(scanFile('.mcp.json', `{ "autoApprove": ["switch_list"], "note": "${DECIDE} is asked" }\n`))).toEqual([]);
        });
    });
});
