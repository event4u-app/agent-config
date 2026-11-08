// `--member-timeout` raises the wall-clock a CLI seat gets for one run: a
// review prompt of every rule body beside its contract (~190 KB) outran the
// fixed 300 s and left the round degraded, which is not convergence.
import { describe, expect, it } from 'vitest';

import { DEFAULT_CLI_TIMEOUT_SECONDS, type CliClient } from '../../../src/scripts/ai_council/clients.js';
import { _construct_cli_member } from '../../../src/scripts/council_cli.js';

// The constructor checks the binary exists; CI runners have no provider CLI.
const BIN = process.execPath;

describe('_construct_cli_member — timeout', () => {
    it('keeps the default when no timeout is given', () => {
        const m = _construct_cli_member('anthropic', null, { binary: BIN }) as CliClient;
        expect(m.timeout_seconds).toBe(DEFAULT_CLI_TIMEOUT_SECONDS);
    });

    it('carries an explicit timeout to every CLI seat', () => {
        for (const name of ['anthropic', 'openai']) {
            const m = _construct_cli_member(name, null, { binary: BIN, timeout_seconds: 900 }) as CliClient;
            expect(m.timeout_seconds, name).toBe(900);
        }
    });
});
