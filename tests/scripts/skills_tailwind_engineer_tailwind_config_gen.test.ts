// Contract tests for src/skills/tailwind-engineer/scripts/tailwind_config_gen.ts
// (py2ts, ADR-094). The tsx twin is the source of truth (the python original
// was deleted in the teardown). Covers the generation paths (validate-only
// default react, the full option matrix on nextjs, vue/svelte frameworks, the
// file-write path for .ts and .js) and the error paths (bad
// color/font/spacing/breakpoint spec → exit 1, invalid framework → exit 2).
// Everything is deterministic — the write path uses throwaway tmp dirs, so
// there is zero git drift; generated output is pinned via inline snapshots.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(
    REPO_ROOT,
    'src',
    'skills',
    'tailwind-engineer',
    'scripts',
    'tailwind_config_gen.ts',
);
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-cfg-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

function runTs(args: string[], cwd: string = REPO_ROOT) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd });
}

describe('tailwind_config_gen — CLI contract', () => {
    it('generated config across frameworks + the full option matrix (pinned)', () => {
        const cases: Record<string, string[]> = {
            'react default (--validate-only)': ['--validate-only'],
            'full matrix (nextjs, --js)': [
                '--validate-only', '--js', '--framework', 'nextjs',
                '--colors', 'brand:#3b82f6', 'accent:#8b5cf6',
                '--fonts', 'sans:Inter,system-ui,sans-serif', "display:'Playfair Display',serif",
                '--spacing', 'navbar:4rem',
                '--breakpoints', '3xl:1920px',
                '--plugins',
            ],
            vue: ['--validate-only', '--framework', 'vue'],
            svelte: ['--validate-only', '--framework', 'svelte'],
        };
        const out = Object.fromEntries(
            Object.entries(cases).map(([label, args]) => {
                const ts = runTs(args);
                expect(ts.status, `${label}: ${ts.stderr}`).toBe(0);
                return [label, ts.stdout];
            }),
        );
        expect(out).toMatchInlineSnapshot(`
          {
            "full matrix (nextjs, --js)": "Added recommended plugins: tailwindcss-animate, @tailwindcss/typography

          Install with:
            npm install -D tailwindcss-animate @tailwindcss/typography
          Configuration valid

          Generated config:
          /** @type {import('tailwindcss').Config} */
          module.exports = {
              "darkMode": [
                "class"
              ],
              "content": [
                "./app/**/*.{js,ts,jsx,tsx}",
                "./pages/**/*.{js,ts,jsx,tsx}",
                "./components/**/*.{js,ts,jsx,tsx}"
              ],
              "theme": {
                "extend": {
                  "colors": {
                    "brand": "#3b82f6",
                    "accent": "#8b5cf6"
                  },
                  "fontFamily": {
                    "sans": [
                      "Inter",
                      "system-ui",
                      "sans-serif"
                    ],
                    "display": [
                      "Playfair Display",
                      "serif"
                    ]
                  },
                  "spacing": {
                    "navbar": "4rem"
                  },
                  "screens": {
                    "3xl": "1920px"
                  }
                }
              }
            plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
          }

          ",
            "react default (--validate-only)": "Warning: No theme extensions defined
          Configuration valid

          Generated config:
          import type { Config } from 'tailwindcss'

          const config: Config = {
              "darkMode": [
                "class"
              ],
              "content": [
                "./src/**/*.{js,jsx,ts,tsx}",
                "./index.html"
              ],
              "theme": {
                "extend": {}
              }
            plugins: [],
          }

          export default config

          ",
            "svelte": "Warning: No theme extensions defined
          Configuration valid

          Generated config:
          import type { Config } from 'tailwindcss'

          const config: Config = {
              "darkMode": [
                "class"
              ],
              "content": [
                "./src/**/*.{svelte,js,ts}",
                "./src/app.html"
              ],
              "theme": {
                "extend": {}
              }
            plugins: [],
          }

          export default config

          ",
            "vue": "Warning: No theme extensions defined
          Configuration valid

          Generated config:
          import type { Config } from 'tailwindcss'

          const config: Config = {
              "darkMode": [
                "class"
              ],
              "content": [
                "./src/**/*.{vue,js,ts,jsx,tsx}",
                "./index.html"
              ],
              "theme": {
                "extend": {}
              }
            plugins: [],
          }

          export default config

          ",
          }
        `);
    });

    it('writes a tailwind.config.ts (file-write path, pinned)', () => {
        const outPath = path.join(mkTmp(), 'tailwind.config.ts');
        const ts = runTs(['--colors', 'brand:#3b82f6', '--output', outPath]);
        expect(ts.status, ts.stderr).toBe(0);
        expect(fs.readFileSync(outPath, 'utf8')).toMatchInlineSnapshot(`
          "import type { Config } from 'tailwindcss'

          const config: Config = {
              "darkMode": [
                "class"
              ],
              "content": [
                "./src/**/*.{js,jsx,ts,tsx}",
                "./index.html"
              ],
              "theme": {
                "extend": {
                  "colors": {
                    "brand": "#3b82f6"
                  }
                }
              }
            plugins: [],
          }

          export default config
          "
        `);
    });

    it('writes a tailwind.config.js (--js write path, pinned)', () => {
        const outPath = path.join(mkTmp(), 'tailwind.config.js');
        const ts = runTs(['--js', '--plugins', '--framework', 'nextjs', '--output', outPath]);
        expect(ts.status, ts.stderr).toBe(0);
        expect(fs.readFileSync(outPath, 'utf8')).toMatchInlineSnapshot(`
          "/** @type {import('tailwindcss').Config} */
          module.exports = {
              "darkMode": [
                "class"
              ],
              "content": [
                "./app/**/*.{js,ts,jsx,tsx}",
                "./pages/**/*.{js,ts,jsx,tsx}",
                "./components/**/*.{js,ts,jsx,tsx}"
              ],
              "theme": {
                "extend": {}
              }
            plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
          }
          "
        `);
    });

    it.each([
        ['--colors', 'Invalid color spec: nocolon'],
        ['--fonts', 'Invalid font spec: nocolon'],
        ['--spacing', 'Invalid spacing spec: nocolon'],
        ['--breakpoints', 'Invalid breakpoint spec: nocolon'],
    ])('bad %s spec → error + exit 1', (flag, marker) => {
        const ts = runTs([flag, 'nocolon']);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toContain(marker);
    });

    it('invalid --framework choice → usage + error + exit 2', () => {
        const ts = runTs(['--framework', 'angular']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain("invalid choice: 'angular'");
    });
});
