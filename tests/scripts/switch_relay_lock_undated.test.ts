/**
 * A holder that cannot date the older single lock file ahead gives it back:
 * undated, a hook of the version before tickets would break it after two
 * seconds. Its own file, because it replaces `utimesSync` for the module.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
    const real = await importOriginal<typeof fs>();
    return {
        ...real,
        utimesSync: (p: fs.PathLike, a: fs.TimeLike, m: fs.TimeLike): void => {
            if (String(p).endsWith('.json.lock')) throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
            real.utimesSync(p, a, m);
        },
    };
});

const { updateSwitchRecord } = await import('../../src/scripts/_lib/switch_relay.js');
const { switchRecordPath } = await import('../../src/scripts/_lib/switch_record_path.js');

let home: string;
beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-undated-'));
});
afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
});

it('a lock whose older file cannot be dated ahead is not held, and leaves no file behind', () => {
    const stateEnv = { EVENT4U_CONFIG_HOME: home };
    let entered = false;
    expect(
        updateSwitchRecord(
            'a'.repeat(16),
            (cur) => {
                entered = true;
                return cur;
            },
            stateEnv,
        ),
    ).toBe(false);
    expect(entered).toBe(false);
    const file = switchRecordPath('a'.repeat(16), stateEnv);
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
    expect(fs.readdirSync(path.dirname(file)).filter((n) => n.includes('.lock'))).toEqual([]);
});
