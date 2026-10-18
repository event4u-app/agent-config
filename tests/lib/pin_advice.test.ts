import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { pin_advice_lines } from '../../src/scripts/_lib/pin_advice';
import { main as updateMain } from '../../src/scripts/_cli/cmd_update';

const MAP = {
    '16.6.0': { impact: 'automatic' },
    '16.7.0': { impact: 'notice', security: true },
    '17.0.0': { impact: 'action' },
    '17.1.0': { impact: 'automatic' },
};

describe('pin_advice_lines', () => {
    it('lists the releases strictly after the pin up to latest, in order', () => {
        const lines = pin_advice_lines('16.6.0', '17.0.0', MAP);
        expect(lines[0]).toBe('Pinned at 16.6.0; latest is 17.0.0.');
        expect(lines.slice(1, 3)).toEqual(['  16.7.0  notice, security fix', '  17.0.0  action']);
        expect(lines.at(-1)).toMatch(/never does/);
    });

    it('says nothing when the pin is at or past latest', () => {
        expect(pin_advice_lines('17.0.0', '17.0.0', MAP)).toEqual([]);
        expect(pin_advice_lines('18.0.0', '17.0.0', MAP)).toEqual([]);
    });

    it('names an absent or forged map instead of trusting it', () => {
        expect(pin_advice_lines('16.0.0', '17.0.0', null).join('\n')).toMatch(/carries no impact map/);
        expect(pin_advice_lines('16.0.0', '17.0.0', undefined).join('\n')).toMatch(/could not be fetched/);
        expect(pin_advice_lines('16.0.0', '17.0.0', MAP, 'target')[0]).toBe('Pinned at 16.0.0; target is 17.0.0.');
        expect(pin_advice_lines('16.0.0', '17.0.0', { 'not-a-version': {} }).join('\n')).toMatch(/not trustworthy/);
        expect(pin_advice_lines('16.0.0', '17.0.0', { '16.9.0': { impact: 'urgent' } }).join('\n')).toMatch(/not trustworthy/);
    });

    it('says when the pin predates the first map entry', () => {
        expect(pin_advice_lines('16.0.0', '17.0.0', MAP).join('\n')).toMatch(/first entry is 16\.6\.0; releases between 16\.0\.0/);
    });
});

describe('update --check in a pinned project (4.4)', () => {
    it('proposes, never moves the pin, and exits 0', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-advice-'));
        try {
            fs.mkdirSync(path.join(dir, '.git'));
            const pinFile = path.join(dir, '.agent-settings.yml');
            fs.writeFileSync(pinFile, 'agent_config_version: "16.6.0"  # team pin\n');
            const before = fs.readFileSync(pinFile);
            let out = '';
            const rc = await updateMain(['--check'], {
                cwd: dir,
                installed_version: '16.6.0',
                fetcher: () => '17.0.0',
                impact_fetcher: () => MAP,
                state_path: path.join(dir, 'state.json'),
                out: { write: (t: string) => (out += t) },
                err: { write: () => undefined },
            });
            expect(rc).toBe(0);
            expect(fs.readFileSync(pinFile).equals(before)).toBe(true);
            expect(out).toContain('Pinned at 16.6.0; latest is 17.0.0.');
            expect(out).toContain('  17.0.0  action');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
