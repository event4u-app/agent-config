// Tests for src/scripts/check_module_management_neutral.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused spec over the pure scanners
// (_scan_frontmatter, _scan_body, _laravel_carveout_span, _split_frontmatter)
// plus golden-parity layers: (a) the REAL repo SKILL.md (clean, exit 0), and
// (b) a temp-repo failing fixture run as a subprocess so SKILL_PATH resolves
// to the injected file. Both skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mmn from '../../src/scripts/check_module_management_neutral.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_module_management_neutral.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_module_management_neutral.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_module_management_neutral — pure scanners', () => {
    it('_split_frontmatter splits on the closing fence', () => {
        const [fm, body] = mmn._split_frontmatter('---\nframework: x\n---\nbody here\n');
        expect(fm).toBe('framework: x');
        expect(body).toBe('body here\n');
    });

    it('_split_frontmatter returns empty fm when no frontmatter', () => {
        const [fm, body] = mmn._split_frontmatter('no frontmatter\n');
        expect(fm).toBe('');
        expect(body).toBe('no frontmatter\n');
    });

    it('_scan_frontmatter flags banned framework key', () => {
        const v = mmn._scan_frontmatter('framework: laravel');
        expect(v).toHaveLength(1);
        expect(v[0]).toContain("banned key 'framework:'");
    });

    it('_scan_frontmatter clean when no banned key', () => {
        expect(mmn._scan_frontmatter('title: x\ndescription: y')).toEqual([]);
    });

    it('_laravel_carveout_span finds the section', () => {
        const body = 'intro\n### Laravel HMVC carve-out\nx\n### Next\ny';
        const span = mmn._laravel_carveout_span(body);
        expect(span).not.toBeNull();
        expect(span![0]).toBe(1);
        expect(span![1]).toBe(3);
    });

    it('_scan_body flags app/Modules/ outside carve-out, allows inside', () => {
        const body =
            '### Laravel HMVC carve-out\napp/Modules/Foo OK here\n### Other\napp/Modules/Bar BAD\n';
        const v = mmn._scan_body(body);
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('line 4');
        // The message embeds Python repr(pattern.pattern). The pattern is
        // `\bapp/Modules/` (one literal backslash); repr() doubles it, so the
        // emitted bytes are: '\\bapp/Modules/' (two backslashes before b).
        expect(v[0]).toContain("'\\\\bapp/Modules/'");
    });

    it('_scan_body reports missing carve-out section', () => {
        const v = mmn._scan_body('# Title\nno carve out\n');
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('carve-out section');
        expect(v[0]).toContain('missing');
    });

    it('_scan_body clean when only carve-out has the literal', () => {
        const body = 'intro\n### Laravel HMVC carve-out\napp/Modules/X\n';
        expect(mmn._scan_body(body)).toEqual([]);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_module_management_neutral — golden parity (python3 vs tsx)', () => {
    it('clean real repo matches byte-for-byte', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('failing fixture matches byte-for-byte (temp repo subprocess)', () => {
        // realpathSync resolves the macOS /var → /private/var symlink so the
        // script's CLI-entry guard (import.meta.url vs argv[1]) matches.
        const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mmn-fixture-')));
        try {
            const scriptsDir = path.join(tmp, 'src', 'scripts');
            fs.mkdirSync(scriptsDir, { recursive: true });
            fs.mkdirSync(path.join(tmp, 'src', 'skills', 'module-management'), { recursive: true });
            fs.copyFileSync(PY_SCRIPT, path.join(scriptsDir, 'check_module_management_neutral.py'));
            fs.copyFileSync(TS_SCRIPT, path.join(scriptsDir, 'check_module_management_neutral.ts'));
            fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
            fs.writeFileSync(
                path.join(tmp, 'src', 'skills', 'module-management', 'SKILL.md'),
                '---\nframework: laravel\n---\n# Module Management\n\n' +
                    'Mentions app/Modules/Foo and App\\\\Modules\\\\Bar outside carve-out.\n\n' +
                    '### Laravel HMVC carve-out\n\nInside app/Modules/X is fine.\n',
                'utf-8',
            );
            const py = spawnSync(
                'python3',
                [path.join(scriptsDir, 'check_module_management_neutral.py')],
                { cwd: tmp, encoding: 'utf8' },
            );
            const ts = spawnSync(
                TSX_BIN,
                [path.join(scriptsDir, 'check_module_management_neutral.ts')],
                { cwd: tmp, encoding: 'utf8' },
            );
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
