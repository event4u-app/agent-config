// A council member CLI that prints more than Node's default `spawnSync`
// buffer (1 MiB) must still be read. Without an explicit `maxBuffer` the
// spawn fails with ENOBUFS, which the probe record stores as an outcome that
// skips the seat on every later run — measured on the openai seat, whose CLI
// prints its working log next to the answer.
import { describe, expect, it } from 'vitest';

import { AnthropicCliClient, type SubprocessResult } from '../../../src/scripts/ai_council/clients.js';

describe('CliClient._runSubprocess — output larger than the default spawn buffer', () => {
    it('returns 2 MiB of child output instead of failing with ENOBUFS', () => {
        const client = new AnthropicCliClient({ binary: '/bin/sh' });
        const run = (
            client as unknown as {
                _runSubprocess: (c: string[], s: string | null) => SubprocessResult;
            }
        )._runSubprocess.bind(client);

        const bytes = 2 * 1024 * 1024;
        const result = run(['/bin/sh', '-c', `head -c ${bytes} /dev/zero | tr '\\000' a`], null);

        expect(result.returncode).toBe(0);
        expect(result.stdout.length).toBe(bytes);
    });
});
