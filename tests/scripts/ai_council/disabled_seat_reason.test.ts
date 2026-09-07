// road-to-admissible-council-seats 1.2 — a disabled seat says why.
//
// `council:status` listed ENABLED members only, so the shipped template's
// `gemini: enabled: false` was invisible on the one surface a reader consults
// to answer "is this council reachable". An undated `enabled: false` teaches
// nothing: it cannot be told apart from untried, unsupported, or deliberately
// parked. This pins both halves — the template carries a dated outcome or a
// named honest null, and the status surface prints it.
//
// `disabled_reason` is a NOTE. Nothing reads it to decide whether a member may
// run, and the tests below assert that boundary rather than assuming it.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { load_council_config } from '../../../src/scripts/ai_council/config.js';
import { cmd_status } from '../../../src/scripts/council_cli.js';
import { NO_DISABLED_REASON } from '../../../src/scripts/ai_council/status_surface.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TEMPLATE = path.join(REPO_ROOT, 'agents', 'templates', '.ai-council.yml.example');

const tmpdirs: string[] = [];
function writeConfig(body: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-disabled-'));
    tmpdirs.push(dir);
    const p = path.join(dir, '.ai-council.yml');
    fs.writeFileSync(p, body, 'utf8');
    return p;
}

afterEach(() => {
    vi.restoreAllMocks();
    while (tmpdirs.length > 0) {
        fs.rmSync(tmpdirs.pop() as string, { recursive: true, force: true });
    }
});

/** Run `cmd_status` against `configPath` and return everything it printed. */
function statusOutput(configPath: string, json = false): string {
    let out = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown): boolean => {
        out += String(chunk);
        return true;
    });
    const rc = cmd_status({ json } as never, { env: { AI_COUNCIL_CONFIG: configPath } });
    expect(rc).toBe(0);
    return out;
}

const ENABLED_ANTHROPIC =
    'enabled: true\ncost_budget:\n  max_total_usd: 20.0\nmembers:\n' +
    '  anthropic:\n    enabled: true\n    model: claude-sonnet-4-5\n' +
    '    api_key_ref: env:ANTHROPIC_KEY\n';

describe('1.2 — the shipped template records why gemini ships off', () => {
    it('the gemini block carries a dated probe outcome or a named honest null', () => {
        const c = load_council_config(TEMPLATE);
        const gemini = c.members.get('gemini');
        expect(gemini).toBeDefined();
        expect(gemini?.enabled).toBe(false);
        const reason = gemini?.disabled_reason ?? '';
        expect(reason).not.toBe('');
        // Either shape is admissible; what is NOT admissible is an undated,
        // unnamed `enabled: false`. A date pins a probe; "honest null" plus a
        // named unknown pins the other branch.
        const dated = /\d{4}-\d{2}-\d{2}/.test(reason);
        const honestNull = /honest null/i.test(reason);
        expect(dated || honestNull).toBe(true);
        // The null must name what could not be established, not merely assert
        // that something could not be.
        expect(reason.toLowerCase()).toContain('headless');
    });
});

describe('1.2 — council:status reports a disabled seat rather than omitting it', () => {
    it('prints the seat and its recorded reason', () => {
        const p = writeConfig(
            `${ENABLED_ANTHROPIC}  gemini:\n    enabled: false\n` +
                '    disabled_reason: "honest null 2026-09-07 — headless contract unobserved"\n',
        );
        const out = statusOutput(p);
        expect(out).toContain('disabled seat    gemini:');
        expect(out).toContain('headless contract unobserved');
    });

    it('names the absence when a disabled seat records no reason at all', () => {
        const p = writeConfig(`${ENABLED_ANTHROPIC}  xai:\n    enabled: false\n`);
        expect(statusOutput(p)).toContain(`disabled seat    xai: ${NO_DISABLED_REASON}`);
    });

    it('carries the same map into --json', () => {
        const p = writeConfig(
            `${ENABLED_ANTHROPIC}  gemini:\n    enabled: false\n` +
                '    disabled_reason: "probed 2026-09-07 — tier ineligible"\n',
        );
        const parsed = JSON.parse(statusOutput(p, true)) as {
            disabled_seats: Record<string, string>;
            member_names: string[];
        };
        expect(parsed.disabled_seats['gemini']).toContain('tier ineligible');
        // The seat is reported, and it is still NOT a member of the council.
        expect(parsed.member_names).not.toContain('gemini');
    });

    it('an enabled seat never appears in the disabled map', () => {
        const p = writeConfig(ENABLED_ANTHROPIC);
        const parsed = JSON.parse(statusOutput(p, true)) as {
            disabled_seats: Record<string, string>;
        };
        expect(Object.keys(parsed.disabled_seats)).toHaveLength(0);
    });
});

describe('1.2 — the field is a note, not an authorization', () => {
    it('an empty or non-string reason fails closed', () => {
        for (const bad of ['""', '"   "', '42', 'true']) {
            const p = writeConfig(
                `${ENABLED_ANTHROPIC}  gemini:\n    enabled: false\n    disabled_reason: ${bad}\n`,
            );
            expect(() => load_council_config(p)).toThrow(/disabled_reason must be a non-empty/);
        }
    });

    it('a reason on a disabled seat does not enable it', () => {
        const p = writeConfig(
            `${ENABLED_ANTHROPIC}  gemini:\n    enabled: false\n` +
                '    disabled_reason: "anything at all"\n',
        );
        expect(load_council_config(p).members.get('gemini')?.enabled).toBe(false);
    });
});
