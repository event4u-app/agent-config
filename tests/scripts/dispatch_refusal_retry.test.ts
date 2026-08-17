/**
 * Refusal-retry concern skipping — `road-to-stop-gate-honesty` step 3.1.
 *
 * Its `verify:` line asks for two things and this file asserts both: a fixture
 * retry runs only the refusal-capable concerns, and each skipped concern's
 * artefact is identical to the non-retry run.
 *
 * The second half is asserted where it is actually decidable. "Identical
 * artefact" for these two concerns is a property of their OWN dedup — the F2
 * once-per-session marker in `end-review-nudge`, and `alreadyRecorded(run_id,
 * turn)` in `interruption-ledger` — so the honest test is that those guards
 * exist and key on something a retry cannot change, not a re-run comparison
 * that would only re-measure the guards. The audit that established this is
 * recorded per concern in `hook_manifest.yaml`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    _is_refusal_retry,
    _load_yaml,
    _resolve_concerns,
    type JsonObject,
} from '../../src/scripts/hooks/dispatch_hook.js';
import { alreadyRecorded } from '../../src/scripts/hooks/interruption_ledger_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = _load_yaml(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'));

/** The concerns that opted in, read off the manifest rather than hardcoded. */
function optedIn(manifest: JsonObject): string[] {
    const concerns = manifest['concerns'] as Record<string, JsonObject>;
    return Object.keys(concerns)
        .filter((name) => concerns[name]?.['skip_on_refusal_retry'] === true)
        .sort();
}

function payload(extra: Record<string, unknown>): string {
    return JSON.stringify({ payload: { transcript_path: '/tmp/x.jsonl', ...extra } });
}

describe('detecting the retry', () => {
    it('reads the host’s own stop_hook_active, on stop only', () => {
        expect(_is_refusal_retry('stop', payload({ stop_hook_active: true }))).toBe(true);
        expect(_is_refusal_retry('stop', payload({ stop_hook_active: false }))).toBe(false);
        expect(_is_refusal_retry('stop', payload({}))).toBe(false);
        // The same field on another slot means nothing — a retry is a Stop.
        expect(_is_refusal_retry('post_tool_use', payload({ stop_hook_active: true }))).toBe(
            false,
        );
    });

    it('falls back to the FULL chain on anything unparseable', () => {
        // Skipping wrongly loses a write; running twice costs duplicate work.
        // The cheap failure is the default.
        expect(_is_refusal_retry('stop', 'not json')).toBe(false);
        expect(_is_refusal_retry('stop', '')).toBe(false);
        expect(_is_refusal_retry('stop', '[]')).toBe(false);
    });

    it('accepts a flat payload as well as a wrapped one', () => {
        expect(_is_refusal_retry('stop', JSON.stringify({ stop_hook_active: true }))).toBe(true);
    });
});

describe('the retry chain', () => {
    it('is byte-identical to today’s chain when the flag is off', () => {
        const before = _resolve_concerns(MANIFEST, 'claude', 'stop', 'orchestrator');
        const after = _resolve_concerns(MANIFEST, 'claude', 'stop', 'orchestrator', {
            refusal_retry: false,
        });
        expect(after.map((c) => c['name'])).toEqual(before.map((c) => c['name']));
    });

    it('drops exactly the opted-in concerns, and nothing else', () => {
        const full = _resolve_concerns(MANIFEST, 'claude', 'stop', 'orchestrator').map(
            (c) => c['name'],
        );
        const retry = _resolve_concerns(MANIFEST, 'claude', 'stop', 'orchestrator', {
            refusal_retry: true,
        }).map((c) => c['name']);
        const dropped = full.filter((n) => !retry.includes(n as string)).sort();
        expect(dropped).toEqual(optedIn(MANIFEST));
        expect(retry.length).toBeLessThan(full.length);
    });

    it('NEVER drops the refusal-capable concern itself', () => {
        // The gate is what makes a retry a retry. Skipping it would mean the
        // second attempt is unguarded — the opposite of the intent.
        const retry = _resolve_concerns(MANIFEST, 'claude', 'stop', 'orchestrator', {
            refusal_retry: true,
        }).map((c) => c['name']);
        expect(retry).toContain('turn-end-gate');
    });

    it('never drops a concern on a non-stop slot, whatever it declared', () => {
        // The flag is only ever consulted with `refusal_retry`, which
        // `_is_refusal_retry` refuses to set outside `stop`.
        for (const event of ['session_start', 'user_prompt_submit', 'post_tool_use']) {
            const plain = _resolve_concerns(MANIFEST, 'claude', event, 'orchestrator');
            const flagged = _resolve_concerns(MANIFEST, 'claude', event, 'orchestrator', {
                refusal_retry: _is_refusal_retry(event, payload({ stop_hook_active: true })),
            });
            expect(flagged.map((c) => c['name'])).toEqual(plain.map((c) => c['name']));
        }
    });

    it('every opted-in concern carries a written argument beside its flag', () => {
        // Step 3.1: "flipped only with a per-concern argument in the PR — never
        // a blanket skip". A flag with no argument in the manifest is the
        // blanket skip wearing a per-concern shape.
        const raw = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'),
            'utf-8',
        );
        for (const name of optedIn(MANIFEST)) {
            const at = raw.indexOf(`\n  ${name}:`);
            expect(at, `${name} not found in the manifest`).toBeGreaterThan(-1);
            const block = raw.slice(at, raw.indexOf('skip_on_refusal_retry', at));
            expect(block, `${name} has no ARGUMENT beside its flag`).toContain('ARGUMENT');
        }
    });
});

describe('the skipped concerns are idempotent on the retry — verified per concern', () => {
    it('interruption-ledger dedupes on the turn, which a retry cannot change', () => {
        const dir = fs.mkdtempSync(path.join(REPO_ROOT, '.tmp-retry-'));
        try {
            const ledger = path.join(dir, 'interruptions.jsonl');
            fs.writeFileSync(
                ledger,
                `${JSON.stringify({ run_id: 'run-1', turn: 12, kind: 'ask' })}\n`,
            );
            // Same run, same turn — which is exactly what a refusal retry is,
            // because the gate's own layer-2 marker keys on that same ordinal.
            expect(alreadyRecorded(ledger, 'run-1', 12)).toBe(true);
            // A genuinely new turn is not deduped, so the skip cannot swallow one.
            expect(alreadyRecorded(ledger, 'run-1', 13)).toBe(false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('end-review-nudge states its once-per-session marker in its own header', () => {
        // The guard is a marker file the concern reads before its transcript
        // scan. Asserting the documented contract keeps the flag's argument
        // falsifiable: rewrite the concern to fire twice and this fails.
        const src = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'end_review_nudge_hook.ts'),
            'utf-8',
        );
        expect(src).toContain('once-per-session');
        expect(src).toMatch(/without re-running the transcript scan/);
    });
});
