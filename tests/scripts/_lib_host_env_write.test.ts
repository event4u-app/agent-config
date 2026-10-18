// The third allow-table row: `subagents.max_parallel` lowered into the host's
// concurrency cap. road-to-a-cold-start-paid-once step 4.1, owner-approved
// 2026-10-14 (decision D12). The row bounds how many workers run at once, never
// whether a call happens, so the table's invariant still holds.
import { describe, expect, it } from 'vitest';

import { hostEnvBlock, WRITABLE_HOST_ENV } from '../../src/scripts/_lib/host_env_write.js';

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
