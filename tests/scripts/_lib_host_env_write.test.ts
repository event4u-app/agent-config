// The third allow-table row: `subagents.max_parallel` lowered into the host's
// concurrency cap. road-to-a-cold-start-paid-once step 4.1, owner-approved
// 2026-10-14 (decision D12). The row bounds how many workers run at once, never
// whether a call happens, so the table's invariant still holds.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    hostEnvBlock,
    MAX_CONCURRENT_SUBAGENTS,
    withHostEnv,
    WRITABLE_HOST_ENV,
} from '../../src/scripts/_lib/host_env_write.js';
import { deepMerge } from '../../src/scripts/_lib/json_merge.js';

describe('host env allow table — concurrency row', () => {
    it('max-parallel-lowers-into-host-cap', () => {
        expect(hostEnvBlock({ subagents: { max_parallel: 2 } })).toEqual({
            CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '2',
        });
        // Absent stays absent: the settings default (3) lives in the schema, and
        // a consumer who never set the key gets no env entry and the host default.
        expect(hostEnvBlock({ subagents: {} })).toBeNull();
        expect(hostEnvBlock({ subagents: { max_parallel: 0 } })).toBeNull();
        expect(hostEnvBlock({ subagents: { max_parallel: '2' } })).toBeNull();
    });

    it('writes the size caps and the concurrency cap side by side', () => {
        expect(
            hostEnvBlock({
                host_environment: { request_size_caps: { bash_max_output_length: 8000 } },
                subagents: { max_parallel: 4 },
            }),
        ).toEqual({ BASH_MAX_OUTPUT_LENGTH: '8000', CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '4' });
    });

    it('the table is exactly three rows, none of them a traffic variable', () => {
        expect(WRITABLE_HOST_ENV.map((r) => r.variable)).toEqual([
            'BASH_MAX_OUTPUT_LENGTH',
            'MAX_MCP_OUTPUT_TOKENS',
            'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',
        ]);
    });
});

describe('host env allow table — bounds and merge (merge-gate review of #2464)', () => {
    it('refuses a concurrency cap above the row maximum', () => {
        expect(hostEnvBlock({ subagents: { max_parallel: MAX_CONCURRENT_SUBAGENTS } })).toEqual({
            CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: String(MAX_CONCURRENT_SUBAGENTS),
        });
        expect(hostEnvBlock({ subagents: { max_parallel: MAX_CONCURRENT_SUBAGENTS + 1 } })).toBeNull();
    });

    it('refuses an integer the host could not read back as written', () => {
        expect(hostEnvBlock({ subagents: { max_parallel: 1e100 } })).toBeNull();
        expect(
            hostEnvBlock({ host_environment: { request_size_caps: { bash_max_output_length: 2 ** 60 } } }),
        ).toBeNull();
    });

    it('an existing env entry in .claude/settings.json survives the install merge', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'host-env-'));
        try {
            fs.mkdirSync(path.join(root, 'agents', 'settings'), { recursive: true });
            fs.writeFileSync(
                path.join(root, 'agents', 'settings', '.agent-settings.yml'),
                'subagents:\n  max_parallel: 2\n',
            );
            const bridge = withHostEnv({ enabledPlugins: { x: true } }, root, () => undefined);
            const existing = { env: { CONSUMER_OWNED: 'keep-me' }, permissions: { allow: ['Read'] } };
            const merged = deepMerge(existing, bridge);
            expect(merged['env']).toEqual({ CONSUMER_OWNED: 'keep-me', CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '2' });
            expect(merged['permissions']).toEqual({ allow: ['Read'] });
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
