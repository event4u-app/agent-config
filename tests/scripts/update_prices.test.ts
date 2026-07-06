// Tests for src/scripts/update_prices.ts (py2ts Phase 8 / Wave 8g).
//
// `refresh()` fetches the LiteLLM feed over the network (non-deterministic)
// and stamps the file with today's UTC date (non-deterministic) — neither is
// assertable. The deterministic, no-network surface is `--check --path`,
// which only reads a supplied prices file; that is the CLI intent-test
// target: exact stdout messages + exit codes for the fresh / stale /
// missing / malformed cases.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { _render_markdown } from '../../src/scripts/ai_council/pricing.js';
import { as_rows } from '../../src/scripts/ai_council/_default_prices.js';
import { _toRowsFromLitellm } from '../../src/scripts/update_prices.js';
import { runTs } from './_wave8g.js';

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

describe('update_prices — --check CLI (tsx, no network)', () => {
    it('fresh file → exit 0 + fresh message', () => {
        const p = freshFile('2099-01-01');
        const r = runTs('update_prices', ['--check', '--path', p]);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe(`[update_prices] ${p} fresh (last_updated=2099-01-01)\n`);
        expect(r.stderr).toBe('');
    });

    it('stale file → exit 1 + stale message', () => {
        const p = freshFile('2000-01-01');
        const r = runTs('update_prices', ['--check', '--path', p]);
        expect(r.status).toBe(1);
        expect(r.stdout).toBe(`[update_prices] ${p} stale (last_updated=2000-01-01)\n`);
        expect(r.stderr).toBe('');
    });

    it('missing file → exit 1 + "missing — run ..." message', () => {
        const p = path.join(mkTmp(), 'absent.md');
        const r = runTs('update_prices', ['--check', '--path', p]);
        expect(r.status).toBe(1);
        expect(r.stdout).toBe(
            `[update_prices] ${p} missing — run \`./scripts-run src/scripts/update_prices\`\n`,
        );
        expect(r.stderr).toBe('');
    });

    it('malformed last_updated → treated stale (exit 1)', () => {
        const d = mkTmp();
        const p = path.join(d, 'p.md');
        // last_updated not ISO → date parse fails → is_stale true.
        fs.writeFileSync(
            p,
            ['---', 'last_updated: not-a-date', 'currency: USD', 'unit: per_1M_tokens', 'source: x', '---', ''].join(
                '\n',
            ),
            'utf-8',
        );
        const r = runTs('update_prices', ['--check', '--path', p]);
        expect(r.status).toBe(1);
        expect(r.stdout).toBe(`[update_prices] ${p} stale (last_updated=not-a-date)\n`);
    });
});
