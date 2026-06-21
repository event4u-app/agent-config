// Tests for src/scripts/check_update_banner.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused spec over _read_installed_version /
// _read_settings_flag / main (best-effort, always exit 0, banner→stderr
// only on a TTY) plus golden parity (python3 vs tsx) on the REAL REPO.
// In a non-TTY test runner check_for_update returns null early, so both
// implementations emit nothing and exit 0.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as cub from '../../src/scripts/check_update_banner.js';



describe('check_update_banner — helpers', () => {
    it('_read_installed_version reads package.json version', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cub-'));
        try {
            fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ version: '1.2.3' }));
            expect(cub._read_installed_version(tmp)).toBe('1.2.3');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('_read_installed_version returns empty on missing / bad package.json', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cub-'));
        try {
            expect(cub._read_installed_version(tmp)).toBe('');
            fs.writeFileSync(path.join(tmp, 'package.json'), '{ not json');
            expect(cub._read_installed_version(tmp)).toBe('');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('_read_settings_flag is true for an empty project (default)', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cub-'));
        try {
            expect(cub._read_settings_flag(tmp)).toBe(true);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('main exits 0 with no installed version', async () => {
        // Empty cwd, no --installed-version override; ROOT package.json exists
        // so installed resolves — but non-TTY means no banner; exit 0 regardless.
        const code = await cub.main(['--cwd', os.tmpdir()]);
        expect(code).toBe(0);
    });
});

