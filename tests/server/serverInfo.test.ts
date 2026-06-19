/**
 * Running-server record — src/server/serverInfo.ts.
 *
 * The record lets `agent-config init` find and stop a prior server. We
 * mock os.homedir() to a temp dir so the test never touches the real
 * ~/.event4u/agent-config/local-server.json.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { writeServerInfo, readServerInfo, clearServerInfo, serverInfoPath } from '../../src/server/serverInfo.js';
import type * as NodeOs from 'node:os';

vi.mock('node:os', async (importOriginal) => {
    const actual = await importOriginal<typeof NodeOs>();
    return { ...actual, homedir: vi.fn(actual.homedir) };
});

describe('serverInfo record', () => {
    let home: string;

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), 'agent-config-home-'));
        vi.mocked(homedir).mockReturnValue(home);
    });
    afterEach(() => {
        rmSync(home, { recursive: true, force: true });
    });

    it('writes, reads back, and clears the record under HOME', () => {
        const path = writeServerInfo({ pid: 4242, port: 41011, url: 'http://127.0.0.1:41011/', startedAt: '2026-05-27T00:00:00.000Z' });
        expect(path.startsWith(home)).toBe(true);
        expect(existsSync(path)).toBe(true);

        const read = readServerInfo();
        expect(read).not.toBeNull();
        expect(read!.pid).toBe(4242);
        expect(read!.port).toBe(41011);

        clearServerInfo();
        expect(existsSync(path)).toBe(false);
        expect(readServerInfo()).toBeNull();
    });

    it('returns null for a malformed record', () => {
        mkdirSync(join(home, '.event4u', 'agent-config'), { recursive: true });
        writeFileSync(serverInfoPath(), 'not json', 'utf8');
        expect(readServerInfo()).toBeNull();
    });
});
