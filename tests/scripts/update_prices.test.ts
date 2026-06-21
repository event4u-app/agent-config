// Tests for src/scripts/update_prices.ts (py2ts Phase 8 / Wave 8g).
//
// No Python test suite exists for this module → focused differential.
//
// `refresh()` fetches the LiteLLM feed over the network (non-deterministic)
// and stamps the file with today's UTC date (non-deterministic) — neither is
// golden-diffable. The deterministic, no-network surface is `--check --path`,
// which only reads a supplied prices file; that is the golden-parity target.
//
// DIVERGENCE NOTE (write path): a live `refresh` run is excluded from
// byte-parity — it depends on network reachability AND `datetime.now(utc)`.
// The fallback shipped-default render IS asserted byte-identical via the
// pricing `_render_markdown` twin (see unit tests below), so the only
// runtime-specific piece left is the date stamp + the live feed contents.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { _render_markdown } from '../../src/scripts/ai_council/pricing.js';
import { as_rows } from '../../src/scripts/ai_council/_default_prices.js';
import { _toRowsFromLitellm } from '../../src/scripts/update_prices.js';
import { hasPython3, runPy, runTs } from './_wave8g.js';

const py3 = hasPython3();

const tmp: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'upd8g-'));
    tmp.push(d);
    return d;
}
afterEach(() => {
    while (tmp.length) {
        fs.rmSync(tmp.pop() as string, { recursive: true, force: true });
    }
});

function freshFile(lastUpdated: string): string {
    const d = mkTmp();
    const p = path.join(d, 'prices.md');
    fs.writeFileSync(p, _render_markdown(lastUpdated, 'shipped-default', as_rows()), 'utf-8');
    return p;
}

describe('update_prices — _toRowsFromLitellm (allow-list + per-1M conversion)', () => {
    it('keeps only allow-listed (provider, model) pairs and scales to per-1M', () => {
        const payload = {
            'anthropic/claude-sonnet-4-5': {
                litellm_provider: 'anthropic',
                input_cost_per_token: 0.000003,
                output_cost_per_token: 0.000015,
            },
            'openai/gpt-4o': {
                litellm_provider: 'openai',
                input_cost_per_token: 0.0000025,
                output_cost_per_token: 0.00001,
            },
            // Not in the allow-list → dropped.
            'openai/gpt-9-ultra': {
                litellm_provider: 'openai',
                input_cost_per_token: 0.001,
                output_cost_per_token: 0.002,
            },
            // Missing numeric costs → dropped.
            'anthropic/claude-haiku-4-5': { litellm_provider: 'anthropic' },
        };
        const rows = _toRowsFromLitellm(payload);
        // sorted (provider, model): anthropic/... before openai/...
        expect(rows.map((r) => [r[0], r[1]])).toEqual([
            ['anthropic', 'claude-sonnet-4-5'],
            ['openai', 'gpt-4o'],
        ]);
        expect(rows[0]![2]).toBeCloseTo(3.0, 9);
        expect(rows[0]![3]).toBeCloseTo(15.0, 9);
        expect(rows[1]![2]).toBeCloseTo(2.5, 9);
    });

    it('strips the provider/ prefix and lowercases the provider', () => {
        const rows = _toRowsFromLitellm({
            'gemini/gemini-2.5-pro': {
                litellm_provider: 'Gemini',
                input_cost_per_token: 0.00000125,
                output_cost_per_token: 0.00001,
            },
        });
        expect(rows).toEqual([['gemini', 'gemini-2.5-pro', 1.25, 10.0]]);
    });
});

describe.skipIf(!py3)('update_prices — --check golden parity (python3 vs tsx, no network)', () => {
    it('fresh file → exit 0, message byte-identical', () => {
        const p = freshFile('2099-01-01');
        const py = runPy('update_prices', ['--check', '--path', p]);
        const ts = runTs('update_prices', ['--check', '--path', p]);
        expect(py.status).toBe(0);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('stale file → exit 1, message byte-identical', () => {
        const p = freshFile('2000-01-01');
        const py = runPy('update_prices', ['--check', '--path', p]);
        const ts = runTs('update_prices', ['--check', '--path', p]);
        expect(py.status).toBe(1);
        expect(ts.status).toBe(1);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('missing file → exit 1, "missing — run ..." byte-identical', () => {
        const p = path.join(mkTmp(), 'absent.md');
        const py = runPy('update_prices', ['--check', '--path', p]);
        const ts = runTs('update_prices', ['--check', '--path', p]);
        expect(py.status).toBe(1);
        expect(ts.status).toBe(1);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('malformed last_updated → treated stale (exit 1) identically', () => {
        const d = mkTmp();
        const p = path.join(d, 'p.md');
        // last_updated not ISO → date.fromisoformat raises → is_stale True.
        fs.writeFileSync(
            p,
            ['---', 'last_updated: not-a-date', 'currency: USD', 'unit: per_1M_tokens', 'source: x', '---', ''].join(
                '\n',
            ),
            'utf-8',
        );
        const py = runPy('update_prices', ['--check', '--path', p]);
        const ts = runTs('update_prices', ['--check', '--path', p]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });
});
