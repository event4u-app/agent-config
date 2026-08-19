/**
 * `telemetry-disclosure` concern — road-to-org-telemetry Phase 3, step 2.
 *
 * The assertion that matters is the silent half, in both directions: an
 * install that did not fully opt in must print nothing AND write nothing, and
 * an install that did must print exactly once — but must print again when the
 * org or the sink changes, because a new recipient is a new disclosure.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    DISCLOSURE_STATE_REL,
    _endpointHost,
    alreadyDisclosed,
    buildDisclosure,
    disclosureKey,
    run,
} from '../../src/scripts/telemetry_disclosure_hook.js';

const roots: string[] = [];

afterEach(() => {
    while (roots.length > 0) {
        fs.rmSync(roots.pop() as string, { recursive: true, force: true });
    }
});

const ACTIVE = `
telemetry:
  remote:
    enabled: true
    endpoint: "https://sink.example.invalid/ingest"
    org_id: "acme"
    salt: "org-pack-secret"
`;

function makeRoot(settingsBody: string | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-disclosure-'));
    roots.push(dir);
    if (settingsBody !== null) {
        fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settingsBody, 'utf-8');
    }
    return dir;
}

function envelope(root: string, event = 'session_start'): string {
    return JSON.stringify({ schema_version: 1, platform: 'claude', event, cwd: root });
}

/** Capture the concern's stdout for one call. */
function capture(stdin: string): { exit: number; out: string } {
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
        chunks.push(s);
        return true;
    };
    try {
        const exit = run(stdin, { now: '2026-08-19T00:00:00.000Z' });
        return { exit, out: chunks.join('') };
    } finally {
        (process.stdout as unknown as { write: typeof original }).write = original;
    }
}

function stateFile(root: string): string {
    return path.join(root, DISCLOSURE_STATE_REL);
}

describe('telemetry-disclosure — silent unless the install actually opted in', () => {
    it.each([
        ['no settings file at all', null],
        ['no telemetry section', 'quality:\n  local_auto_run: false\n'],
        ['enabled but no endpoint/org/salt', 'telemetry:\n  remote:\n    enabled: true\n'],
        ['fully configured but disabled', ACTIVE.replace('enabled: true', 'enabled: false')],
        ['configured but salt missing', ACTIVE.replace('    salt: "org-pack-secret"\n', '')],
    ])('%s → exit 0, no output, no state written', (_label, body) => {
        const root = makeRoot(body);
        const { exit, out } = capture(envelope(root));
        expect(exit).toBe(0);
        expect(out).toBe('');
        expect(fs.existsSync(stateFile(root))).toBe(false);
    });

    it('ignores every slot that is not session_start', () => {
        const root = makeRoot(ACTIVE);
        for (const event of ['post_tool_use', 'pre_tool_use', 'stop', 'user_prompt_submit']) {
            const { out } = capture(envelope(root, event));
            expect(out).toBe('');
        }
        expect(fs.existsSync(stateFile(root))).toBe(false);
    });

    it('is silent on a malformed envelope rather than throwing', () => {
        expect(capture('not json at all').exit).toBe(0);
        expect(capture('').exit).toBe(0);
    });
});

describe('telemetry-disclosure — the line itself', () => {
    it('discloses the fact, the recipient, and where to read the records', () => {
        const root = makeRoot(ACTIVE);
        const { exit, out } = capture(envelope(root));
        expect(exit).toBe(0);

        const payload = JSON.parse(out.trim()) as Record<string, unknown>;
        expect(payload['decision']).toBe('allow');
        const context = payload['context'] as string;

        expect(context).toContain('<telemetry-disclosure>');
        expect(context).toContain('</telemetry-disclosure>');
        // Who, and on whose authority.
        expect(context).toContain('acme');
        expect(context).toContain('sink.example.invalid');
        expect(context).toContain('org administrator');
        // Where to read it, from the settings rather than a hardcoded name.
        expect(context).toContain('.agent-telemetry.jsonl');
    });

    it('never carries the salt, and never the full endpoint path', () => {
        const root = makeRoot(ACTIVE);
        const { out } = capture(envelope(root));
        expect(out).not.toContain('org-pack-secret');
        expect(out).not.toContain('/ingest');
    });

    it('reduces a URL to its host and passes a non-URL through unchanged', () => {
        expect(_endpointHost('https://sink.example.invalid/ingest?t=1')).toBe('sink.example.invalid');
        expect(_endpointHost('not a url')).toBe('not a url');
    });

    it('fits the per-concern injection budget with headroom', () => {
        // The manifest carries no `per_concern_caps_bytes` row for this
        // concern, so the 1024-byte default applies. Asserted here rather than
        // discovered by `bench_hook_injection` failing the build.
        const root = makeRoot(ACTIVE);
        const { out } = capture(envelope(root));
        expect(Buffer.byteLength(out)).toBeLessThanOrEqual(1024);
    });
});

describe('telemetry-disclosure — once, and again when the recipient changes', () => {
    it('emits on the first session start and stays silent afterwards', () => {
        const root = makeRoot(ACTIVE);

        expect(capture(envelope(root)).out).not.toBe('');
        expect(fs.existsSync(stateFile(root))).toBe(true);

        for (let i = 0; i < 3; i += 1) {
            expect(capture(envelope(root)).out).toBe('');
        }
    });

    it('re-discloses when the org changes — a new recipient is a new disclosure', () => {
        const root = makeRoot(ACTIVE);
        expect(capture(envelope(root)).out).not.toBe('');

        fs.writeFileSync(
            path.join(root, '.agent-settings.yml'),
            ACTIVE.replace('org_id: "acme"', 'org_id: "other-org"'),
            'utf-8',
        );
        const second = capture(envelope(root));
        expect(second.out).toContain('other-org');
    });

    it('re-discloses when the sink changes, with the org unchanged', () => {
        const root = makeRoot(ACTIVE);
        expect(capture(envelope(root)).out).not.toBe('');

        fs.writeFileSync(
            path.join(root, '.agent-settings.yml'),
            ACTIVE.replace('sink.example.invalid', 'elsewhere.example.invalid'),
            'utf-8',
        );
        expect(capture(envelope(root)).out).toContain('elsewhere.example.invalid');
    });

    it('treats an unreadable state file as not-yet-disclosed, so a line is repeated rather than suppressed', () => {
        const root = makeRoot(ACTIVE);
        const facts = { org_id: 'acme', endpoint: 'https://x.invalid', log_path: 'a.jsonl' };

        fs.mkdirSync(path.dirname(stateFile(root)), { recursive: true });
        for (const corrupt of ['', 'not json', 'null', '[]', '{"disclosed": 42}']) {
            fs.writeFileSync(stateFile(root), corrupt, 'utf-8');
            expect(alreadyDisclosed(root, facts)).toBe(false);
        }

        fs.writeFileSync(
            stateFile(root),
            JSON.stringify({ disclosed: disclosureKey(facts) }),
            'utf-8',
        );
        expect(alreadyDisclosed(root, facts)).toBe(true);
    });

    it('keys the disclosure on both org and endpoint, not on either alone', () => {
        const base = { org_id: 'a', endpoint: 'e', log_path: 'l' };
        expect(disclosureKey(base)).not.toBe(disclosureKey({ ...base, org_id: 'b' }));
        expect(disclosureKey(base)).not.toBe(disclosureKey({ ...base, endpoint: 'f' }));
        // The log path is presentation, not identity — changing where the file
        // sits does not change who receives the data.
        expect(disclosureKey(base)).toBe(disclosureKey({ ...base, log_path: 'other' }));
    });

    it('builds a stable block for a given set of facts', () => {
        const facts = { org_id: 'acme', endpoint: 'https://s.invalid/x', log_path: 'l.jsonl' };
        expect(buildDisclosure(facts)).toBe(buildDisclosure({ ...facts }));
    });
});
