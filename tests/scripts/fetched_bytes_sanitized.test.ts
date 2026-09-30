/**
 * The two fetch-derived paths the sanitize floor did not reach
 * (road-to-a-sanitize-list-that-is-generated, Phase 2).
 *
 * Both close a path where bytes from the wire reached a model-facing surface
 * unfiltered: `update_prices` renders remote rows into a tracked markdown file
 * that agents read, and `llm_proposer_transport` returns a provider response
 * straight into the run.
 *
 * Each suite asserts the transform AND its boundary — the fetched payload is
 * not rewritten where it is held, only the copy that is handed onward. A test
 * that proved only the stripping would be satisfied by a change that mangles
 * the source data too.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { _render_markdown } from '../../src/scripts/ai_council/pricing.js';
import { _toRowsFromLitellm } from '../../src/scripts/update_prices.js';

/** A zero-width-joined instruction — invisible in a rendered table. */
const ZWJ = '‍';
const BIDI_OVERRIDE = '‮';

const tmp: string[] = [];
afterEach(() => {
    while (tmp.length) fs.rmSync(tmp.pop() as string, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe('update_prices — fetched rows reach the tracked doc sanitized', () => {
    it('renders a clean row with no vector reaching the tracked doc', () => {
        // The rendering is the model-facing copy and carries the floor. The
        // identifier here is allow-listed and clean; the vector cases below own
        // the poisoned direction.
        const rows = _toRowsFromLitellm({
            'openai/gpt-4o': {
                litellm_provider: 'openai',
                input_cost_per_token: 0.0000025,
                output_cost_per_token: 0.00001,
            },
        });
        expect(rows).toHaveLength(1);

        const rendered = _render_markdown('2026-01-01', 'litellm-github', rows);
        expect(rendered).not.toContain(ZWJ);
        expect(rendered).toContain('gpt-4o');
    });

    // REPLACES a test that asserted the opposite and was right about the wrong
    // risk. It read: 'sanitizes BEFORE the allow-list compare, so a vector is
    // stripped rather than dropping the row', on the reasoning that dropping is
    // silent data loss. An independent review named the cost of that order and
    // it is the worse one: sanitizing is lossy, so a poisoned remote name can
    // NORMALISE ONTO an allow-listed one and be admitted wearing a trusted
    // identifier. Dropping an injection attempt is the correct outcome; being
    // admitted as `claude-sonnet-4-5` is not.
    it('does NOT admit a poisoned name that normalises onto an allow-listed one', () => {
        const rows = _toRowsFromLitellm({
            [`anthropic/claude-sonnet-4${ZWJ}-5`]: {
                litellm_provider: 'anthropic',
                input_cost_per_token: 0.000003,
                output_cost_per_token: 0.000015,
            },
        });
        expect(rows).toHaveLength(0);
    });

    it('still admits the same identifier when it arrives clean', () => {
        // The pair is what makes the case about the ORDER rather than about the
        // name: identical allow-list entry, one poisoned arrival and one clean.
        const rows = _toRowsFromLitellm({
            'anthropic/claude-sonnet-4-5': {
                litellm_provider: 'anthropic',
                input_cost_per_token: 0.000003,
                output_cost_per_token: 0.000015,
            },
        });
        expect(rows).toHaveLength(1);
        expect(rows[0][1]).toBe('claude-sonnet-4-5');
    });

    it('leaves the fetched payload on disk byte-exact', () => {
        // The floor applies to the model-facing rendering. Whatever holds the
        // raw fetched bytes is not this path's to rewrite.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prices-fixture-'));
        tmp.push(dir);
        const fixturePath = path.join(dir, 'litellm.json');
        const payload = {
            [`openai/gpt${ZWJ}-4o`]: {
                litellm_provider: 'openai',
                input_cost_per_token: 0.0000025,
                output_cost_per_token: 0.00001,
            },
        };
        const raw = JSON.stringify(payload);
        fs.writeFileSync(fixturePath, raw, 'utf-8');

        _toRowsFromLitellm(JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as typeof payload);

        expect(fs.readFileSync(fixturePath, 'utf-8')).toBe(raw);
        expect(fs.readFileSync(fixturePath, 'utf-8')).toContain(ZWJ);
    });

    it('reports the collision rather than dropping it with every other miss', () => {
        // A raw miss whose sanitized form WOULD have matched is a different
        // event from an ordinary unlisted name, and printing both as the same
        // silence is what would hide an admission attempt.
        const errs: string[] = [];
        const orig = process.stderr.write.bind(process.stderr);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.stderr as any).write = (c: string): boolean => {
            errs.push(String(c));
            return true;
        };
        try {
            _toRowsFromLitellm({
                [`anthropic/claude-sonnet-4${ZWJ}-5`]: {
                    litellm_provider: 'anthropic',
                    input_cost_per_token: 0.000003,
                    output_cost_per_token: 0.000015,
                },
            });
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (process.stderr as any).write = orig;
        }
        expect(errs.join('')).toContain('normalises onto');
    });

    it('drops a model genuinely outside the allow-list', () => {
        // The floor must not widen the allow-list — a name that is simply not
        // ours still fails the lookup.
        expect(
            _toRowsFromLitellm({
                'openai/not-a-model-we-ship': {
                    litellm_provider: 'openai',
                    input_cost_per_token: 1,
                    output_cost_per_token: 1,
                },
            }),
        ).toEqual([]);
    });
});

describe('llm_proposer_transport — the provider response is sanitized at the choke point', () => {
    /** Stub `fetch` with one Anthropic-shaped response body. */
    function stubAnthropic(text: string): void {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ content: [{ type: 'text', text }] }),
                    text: () => Promise.resolve(''),
                } as unknown as Response),
            ),
        );
    }

    async function generate(responseText: string): Promise<string> {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transport-key-'));
        tmp.push(dir);
        const keyPath = path.join(dir, 'key');
        // The key loader refuses a world-readable credential file, and it is
        // right to — the fixture obeys the real gate rather than bypassing it.
        fs.writeFileSync(keyPath, 'sk-ant-fixture-not-a-real-key\n', { encoding: 'utf-8', mode: 0o600 });
        fs.chmodSync(keyPath, 0o600);
        stubAnthropic(responseText);
        const { anthropicGenerator } = await import(
            '../../src/scripts/_lib/llm_proposer_transport.js'
        );
        const out = await anthropicGenerator(keyPath)({ system: 's', prompt: 'p' });
        return out.text;
    }

    it('strips a bidi-control vector from the returned text', async () => {
        const text = await generate(`safe ${BIDI_OVERRIDE}payload text`);
        expect(text).not.toContain(BIDI_OVERRIDE);
        expect(text).toContain('safe');
        expect(text).toContain('payload text');
    });

    it('strips a zero-width run without touching ordinary prose', async () => {
        expect(await generate(`a${ZWJ}b`)).toBe('ab');
        expect(await generate('an ordinary sentence.')).toBe('an ordinary sentence.');
    });

    it('returns an empty body as an empty body — the transport repairs nothing', async () => {
        expect(await generate('')).toBe('');
    });
});
