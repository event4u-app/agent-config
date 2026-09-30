// The only host environment variables this package will ever write.
//
// road-to-host-traffic-knobs-that-ship 4.1, owner-decided 2026-09-30.
//
// The guarantee under test is NEGATIVE and it is the reason the feature exists:
// neither traffic variable may ever be written. Both reach the host's
// update-disabled resolver — the blanket one as its third rung — so a writer
// able to express either could disable a consumer's security updates. The
// positive cases matter less than the negative one, which is why the negative
// assertion names both variables literally rather than checking a count.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { hostEnvBlock, readSettingsDoc } from '../../src/scripts/_lib/host_env_write.js';

/** The two names that must never appear in an emitted env block. */
const FORBIDDEN = ['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'DISABLE_AUTOUPDATER'] as const;

describe('hostEnvBlock — what may be written', () => {
    it('writes nothing when the section is absent', () => {
        expect(hostEnvBlock({})).toBeNull();
        expect(hostEnvBlock(null)).toBeNull();
        expect(hostEnvBlock(undefined)).toBeNull();
    });

    it('writes nothing when both caps are null — null IS the off switch', () => {
        expect(
            hostEnvBlock({
                host_environment: { request_size_caps: { bash_max_output_length: null, max_mcp_output_tokens: null } },
            }),
        ).toBeNull();
    });

    it('returns null rather than an empty object, so "wrote nothing" is not an `env: {}`', () => {
        const out = hostEnvBlock({ host_environment: { request_size_caps: {} } });
        expect(out).toBeNull();
        expect(out).not.toEqual({});
    });

    it('writes exactly the two size variables when both are set', () => {
        expect(
            hostEnvBlock({
                host_environment: { request_size_caps: { bash_max_output_length: 8000, max_mcp_output_tokens: 4000 } },
            }),
        ).toEqual({ BASH_MAX_OUTPUT_LENGTH: '8000', MAX_MCP_OUTPUT_TOKENS: '4000' });
    });

    it('writes only the cap that is set', () => {
        expect(
            hostEnvBlock({
                host_environment: { request_size_caps: { bash_max_output_length: 8000, max_mcp_output_tokens: null } },
            }),
        ).toEqual({ BASH_MAX_OUTPUT_LENGTH: '8000' });
    });

    // The schema refuses these; this is the hand-edited-file case.
    it('ignores a non-positive, non-integer or non-numeric value rather than writing it', () => {
        for (const bad of [0, -1, 1.5, '8000', true, [], {}]) {
            expect(
                hostEnvBlock({
                    host_environment: { request_size_caps: { bash_max_output_length: bad } },
                }),
            ).toBeNull();
        }
    });

    // THE LOAD-BEARING CASE. A settings file that tries to name a traffic
    // variable — by the key this package reads, or by the variable's own name —
    // produces no env entry for it. The allow-table is two rows, so there is no
    // path from any other key to an emitted variable.
    it('never emits a traffic or auto-updater variable, whatever the settings say', () => {
        const hostile = {
            host_environment: {
                request_size_caps: {
                    bash_max_output_length: 8000,
                    max_mcp_output_tokens: 4000,
                    disable_autoupdater: 1,
                    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
                    DISABLE_AUTOUPDATER: 1,
                    disable_nonessential_traffic: 1,
                },
            },
        };
        const out = hostEnvBlock(hostile);
        expect(out).toEqual({ BASH_MAX_OUTPUT_LENGTH: '8000', MAX_MCP_OUTPUT_TOKENS: '4000' });
        for (const name of FORBIDDEN) expect(Object.keys(out ?? {})).not.toContain(name);
    });

    // END TO END through the reader the installer actually calls. A first
    // version of this case wrote the file and then parsed a LITERAL of what it
    // hoped the file said, which asserts nothing about the YAML path — it would
    // have passed with the file absent. `_read_settings_doc` is exported for
    // this, and the `null` cap in the fixture is the half a literal would most
    // easily get wrong.
    it('reads the settings document off disk through the installer reader', () => {
        const root = mkdtempSync(join(tmpdir(), 'host-env-'));
        try {
            mkdirSync(join(root, 'agents', 'settings'), { recursive: true });
            writeFileSync(
                join(root, 'agents', 'settings', '.agent-settings.yml'),
                'host_environment:\n  request_size_caps:\n    bash_max_output_length: 12000\n    max_mcp_output_tokens: null\n',
                'utf-8',
            );
            expect(hostEnvBlock(readSettingsDoc(root))).toEqual({ BASH_MAX_OUTPUT_LENGTH: '12000' });
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it('writes nothing when there is no settings file at all', () => {
        const root = mkdtempSync(join(tmpdir(), 'host-env-none-'));
        try {
            expect(readSettingsDoc(root)).toBeNull();
            expect(hostEnvBlock(readSettingsDoc(root))).toBeNull();
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
