/**
 * `lint_adapter_tier` — a `stable` tier claim must resolve to evidence a
 * reviewer holding a clone can actually reach.
 *
 * The defect it closes: seven adapter headers read `# Lifecycle: stable —
 * promoted 2026-06-10 (maintainer-authorized)`, and the smoke traces that
 * promotion rests on are local-only (`git ls-files` over the trace path
 * returns 0, by the deliberate decision in `d7f5d5d3c`). Nothing in the tree
 * could tell a reviewer whether the evidence existed at all, and nothing
 * stopped the next adapter from claiming `stable` with no evidence whatsoever.
 *
 * Both directions are pinned, because only the pair proves discrimination:
 * an empty index must FAIL and name all seven, and the real index must PASS.
 * A test that only asserted the green would have passed against a gate that
 * scanned nothing.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    check,
    contractDrift,
    main,
    spliceContract,
    tierTable,
} from '../../src/scripts/lint_adapter_tier.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const ADAPTERS_REL = path.join('src', 'scripts', 'ai-video', 'adapters');
const IMG_ADAPTERS_REL = path.join('src', 'scripts', 'ai-image', 'adapters');
const MANIFESTS_REL = path.join('src', 'scripts', 'ai-video', 'lib', 'model-capabilities');
const INDEX_REL = path.join('agents', 'evidence', 'ai-video', 'trace-index.json');

/**
 * A fixture tree with the same shape as the real one: `stable` and
 * `experimental` headers, an index, and a manifest carrying a `smoke_trace`
 * reference. Every knob a test needs is a parameter, so no case has to write
 * its own tree by hand.
 */
function fixture(opts: {
    tiers: Record<string, string>;
    index: unknown[];
    manifests?: Record<string, unknown>;
    imageTiers?: Record<string, string>;
}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adapter-tier-'));
    fs.mkdirSync(path.join(root, ADAPTERS_REL), { recursive: true });
    fs.mkdirSync(path.join(root, IMG_ADAPTERS_REL), { recursive: true });
    fs.mkdirSync(path.join(root, MANIFESTS_REL), { recursive: true });
    fs.mkdirSync(path.join(root, path.dirname(INDEX_REL)), { recursive: true });

    for (const [name, tier] of Object.entries(opts.tiers)) {
        fs.writeFileSync(
            path.join(root, ADAPTERS_REL, `${name}.sh`),
            `#!/usr/bin/env bash\n# ${name} adapter\n# Lifecycle: ${tier} — fixture header\nexit 0\n`,
        );
    }
    for (const [name, tier] of Object.entries(opts.imageTiers ?? {})) {
        fs.writeFileSync(
            path.join(root, IMG_ADAPTERS_REL, `${name}.sh`),
            `#!/usr/bin/env bash\n# Lifecycle: ${tier} — fixture header\nexit 0\n`,
        );
    }
    fs.writeFileSync(path.join(root, INDEX_REL), JSON.stringify(opts.index, null, 2));
    for (const [name, body] of Object.entries(opts.manifests ?? {})) {
        fs.writeFileSync(path.join(root, MANIFESTS_REL, `${name}.json`), JSON.stringify(body, null, 2));
    }
    return root;
}

/** A row whose capture date is `daysAgo` days before now. */
function row(provider: string, daysAgo: number, traceId = `${provider}-t`) {
    const d = new Date(Date.now() - daysAgo * 86_400_000);
    const stamp = d.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
    return { provider, trace_id: traceId, captured_at: stamp, model: null, sha256: 'x'.repeat(64) };
}

describe('lint_adapter_tier', () => {
    it('fails on an empty index and names every stable adapter', () => {
        const root = fixture({
            tiers: {
                fal: 'stable',
                'gemini-veo': 'stable',
                higgsfield: 'stable',
                kling: 'stable',
                replicate: 'stable',
                sora: 'stable',
                'openai-images': 'stable',
                comfyui: 'experimental',
            },
            index: [],
        });
        const res = check(root);
        expect(res.code).toBe(1);
        expect(res.findings).toHaveLength(7);
        for (const name of ['fal', 'gemini-veo', 'higgsfield', 'kling', 'replicate', 'sora', 'openai-images']) {
            expect(res.findings.some((f) => f.adapter === name)).toBe(true);
        }
        // The experimental adapter is scanned but never a finding.
        expect(res.findings.some((f) => f.adapter === 'comfyui')).toBe(false);
        expect(res.scanned).toBe(8);
    });

    it('passes when every stable adapter has a fresh row', () => {
        const root = fixture({
            tiers: { fal: 'stable', comfyui: 'experimental' },
            index: [row('fal', 10)],
        });
        expect(check(root).code).toBe(0);
    });

    it('fails a stable adapter whose only row is older than the window', () => {
        const root = fixture({ tiers: { fal: 'stable' }, index: [row('fal', 200)] });
        const res = check(root);
        expect(res.code).toBe(1);
        expect(res.findings[0]?.reason).toMatch(/stale|old|window|180/i);
    });

    it('fails a dangling smoke_trace reference in a manifest', () => {
        const root = fixture({
            tiers: { fal: 'stable' },
            index: [row('fal', 10, 'fal-real')],
            manifests: {
                fal: {
                    schema: 1,
                    adapter: 'fal',
                    models: { 'a/b': { verified: true, smoke_trace: 'fal-does-not-exist' } },
                },
            },
        });
        const res = check(root);
        expect(res.code).toBe(1);
        expect(res.findings.some((f) => f.reason.includes('fal-does-not-exist'))).toBe(true);
    });

    it('accepts a smoke_trace reference that resolves', () => {
        const root = fixture({
            tiers: { fal: 'stable' },
            index: [row('fal', 10, 'fal-real')],
            manifests: {
                fal: { schema: 1, adapter: 'fal', models: { 'a/b': { verified: true, smoke_trace: 'fal-real' } } },
            },
        });
        expect(check(root).code).toBe(0);
    });

    it('exits 2 — never 0 — when the index file is absent', () => {
        const root = fixture({ tiers: { fal: 'stable' }, index: [] });
        fs.rmSync(path.join(root, INDEX_REL));
        expect(check(root).code).toBe(2);
    });

    it('exits 2 when the adapter corpus is empty rather than reporting clean', () => {
        const root = fixture({ tiers: {}, index: [] });
        expect(check(root).code).toBe(2);
    });

    it('is green against the real repository tree', () => {
        const res = check(REPO_ROOT);
        expect(res.findings.map((f) => `${f.adapter}: ${f.reason}`)).toEqual([]);
        expect(res.code).toBe(0);
        // A floor, not a zero-check: the real corpus is 11 adapters + 4 image.
        expect(res.scanned).toBeGreaterThanOrEqual(14);
    });
});

describe('lint_adapter_tier — the generated contract table', () => {
    it('agrees with the tree as committed', () => {
        expect(contractDrift(REPO_ROOT)).toBeNull();
    });

    it('reds when the table is edited by hand — the sabotage probe', () => {
        // Sensitivity, proven rather than assumed: neutralise the mechanism and
        // watch the check fail. A drift check never seen red would pass just as
        // happily against a splice that returned its input unchanged.
        const contract = path.join(REPO_ROOT, 'docs', 'contracts', 'provider-lifecycle.md');
        const original = fs.readFileSync(contract, 'utf-8');
        try {
            fs.writeFileSync(contract, original.replace('| `fal` |', '| `fal-HAND-EDITED` |'));
            expect(contractDrift(REPO_ROOT)).toMatch(/stale/);
            expect(main(['--quiet'])).toBe(1);
        } finally {
            fs.writeFileSync(contract, original);
        }
        // Restored — and the restore is itself asserted, because a `finally`
        // that silently failed would leave the tree dirty for every later test.
        expect(fs.readFileSync(contract, 'utf-8')).toBe(original);
        expect(contractDrift(REPO_ROOT)).toBeNull();
    });

    it('refuses a contract with no markers instead of appending a second table', () => {
        expect(() => spliceContract('no markers here', 'x')).toThrow(/markers/);
    });

    it('splices idempotently', () => {
        const text = `head\n<!-- BEGIN GENERATED: adapter-tier-table -->\nold\n<!-- END GENERATED: adapter-tier-table -->\ntail\n`;
        const once = spliceContract(text, 'NEW');
        expect(spliceContract(once, 'NEW')).toBe(once);
        expect(once).toContain('NEW');
        expect(once).not.toContain('old');
    });

    it('marks an adapter with no index row as such rather than omitting the row', () => {
        const table = tierTable(REPO_ROOT);
        expect(table).toMatch(/`comfyui`.*none in the index/);
        expect(table.split('\n').length).toBeGreaterThanOrEqual(16);
    });
});
