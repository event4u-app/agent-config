/**
 * road-to-a-link-with-agent-switch 2.1 — the link probe.
 *
 * A real executable named `agent-switch` sits on an injected PATH, so the probe
 * spawns a process exactly as it does in production; only its answers are
 * scripted (FAKE_AS_LINK).
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { probeLink } from '../../src/scripts/_lib/agent_switch_link.js';

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake_agent_switch.mjs');
const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A PATH holding a working `agent-switch`, plus the env that scripts it. */
function env(extra: Record<string, string> = {}): Record<string, string> {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'as-link-'));
    dirs.push(bin);
    const exe = path.join(bin, 'agent-switch');
    fs.writeFileSync(exe, `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "$@"\n`, 'utf-8');
    fs.chmodSync(exe, 0o755);
    return { PATH: `${bin}${path.delimiter}${path.dirname(process.execPath)}`, ...extra };
}

function emptyPath(): Record<string, string> {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'as-none-'));
    dirs.push(bin);
    return { PATH: bin };
}

describe('2.1 probeLink', () => {
    it('present: enabled and contract 1', () => {
        expect(probeLink({ env: env() })).toEqual({
            state: 'present',
            status: { enabled: true, version: '2.13.0', contract: 1, mcp: { command: 'agent-switch', args: ['mcp', 'serve'] } },
        });
    });

    it('disabled: enabled false reads as disabled', () => {
        expect(probeLink({ env: env({ FAKE_AS_LINK: 'off' }) }).state).toBe('disabled');
    });

    it('incompatible: a contract this build does not speak is not present', () => {
        expect(probeLink({ env: env({ FAKE_AS_LINK: 'contract2' }) }).state).toBe('incompatible');
    });

    it('absent: no binary on PATH', () => {
        expect(probeLink({ env: emptyPath() }).state).toBe('absent');
    });

    it('failed: garbled output and a non-zero exit are never guessed at', () => {
        expect(probeLink({ env: env({ FAKE_AS_LINK: 'garbled' }) }).state).toBe('failed');
        expect(probeLink({ env: env({ FAKE_AS_LINK: 'exit1' }) }).state).toBe('failed');
    });
});
