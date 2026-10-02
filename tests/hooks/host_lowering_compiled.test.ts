/**
 * The compiled `host_lowering.json` fast path.
 *
 * WHAT THESE TESTS ARE FOR. The optimisation's safety claim is "a stale or
 * absent sibling is SLOW, never WRONG", and that claim lives entirely in the
 * fallback branches — the happy path is trivially verifiable and carries no
 * risk. So every test below was written to fail if a fallback branch were
 * removed, and the parity test is the one that would catch the only silent
 * failure mode left: two paths that agree on the fingerprint and disagree on
 * the table.
 *
 * Each of these was run RED before the branch it covers existed, by
 * neutralising that branch, not by assuming the green tick meant something.
 */
import * as fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { compile } from '../../src/scripts/compile_hook_manifest.js';
import {
    HOST_LOWERING_JSON_PATH,
    HOST_LOWERING_PATH,
    parseHostLowering,
    resolveTable,
} from '../../src/scripts/hooks/host_lowering.js';
import { tableFingerprint } from '../../src/scripts/hooks/table_fingerprint.js';

const YAML_TEXT = fs.readFileSync(HOST_LOWERING_PATH, 'utf-8');

/** Both paths must produce the same table, or the fast path is a wrong answer. */
function tableShape(t: ReturnType<typeof parseHostLowering>): string {
    return JSON.stringify(
        [...t.entries()]
            .map(([host, surfaces]) => [host, [...surfaces.entries()].map(([s, row]) => [s, row])])
            .sort(),
    );
}

describe('the committed sibling', () => {
    it('is current against the live YAML', () => {
        // The freshness assertion `check_generator_sync` also makes. Kept here
        // too because a unit test names the file in its failure message and the
        // gate names a diff, and the first is what a developer reads.
        const committed = JSON.parse(fs.readFileSync(HOST_LOWERING_JSON_PATH, 'utf-8')) as {
            fingerprint: string;
        };
        expect(committed.fingerprint).toBe(tableFingerprint(YAML_TEXT));
    });
});

describe('resolveTable — the fast path and every fallback', () => {
    it('produces the SAME table from the compiled form as from the source', () => {
        const fromJson = resolveTable(YAML_TEXT, compile(YAML_TEXT, 'host-lowering'));
        const fromYaml = parseHostLowering(YAML_TEXT);
        expect(tableShape(fromJson)).toBe(tableShape(fromYaml));
        // Not vacuous: assert the table is non-empty, or two empty maps would
        // satisfy the equality above and the test would pass over a broken
        // structurer.
        expect(fromJson.size).toBeGreaterThan(0);
    });

    it('falls back to the source when the sibling is absent', () => {
        const t = resolveTable(YAML_TEXT, null);
        expect(tableShape(t)).toBe(tableShape(parseHostLowering(YAML_TEXT)));
    });

    it('falls back when the fingerprint is stale', () => {
        // The whole point of the fingerprint: a compiled file whose DATA is
        // wrong but whose shape is valid must not be trusted. Compile a
        // DIFFERENT source, then hand it the real YAML.
        const stale = compile('hosts:\n  ghost:\n    surfaces:\n      any: {}\n', 'host-lowering');
        const t = resolveTable(YAML_TEXT, stale);
        expect(t.has('ghost')).toBe(false);
        expect(tableShape(t)).toBe(tableShape(parseHostLowering(YAML_TEXT)));
    });

    it('falls back when the sibling is malformed JSON', () => {
        const t = resolveTable(YAML_TEXT, '{ not json');
        expect(tableShape(t)).toBe(tableShape(parseHostLowering(YAML_TEXT)));
    });

    it('falls back when the fingerprint matches but the table is missing', () => {
        const noTable = JSON.stringify({ fingerprint: tableFingerprint(YAML_TEXT) });
        const t = resolveTable(YAML_TEXT, noTable);
        expect(tableShape(t)).toBe(tableShape(parseHostLowering(YAML_TEXT)));
    });

    it('USES the compiled table when it is current — not merely tolerates it', () => {
        // Without this the suite would pass with the fast path deleted, since
        // every other case asserts the fallback's answer. A row that exists
        // ONLY in the compiled blob proves which branch ran.
        //
        // road-to-blocking-severities 2.3 changed what this fixture must do.
        // The body check added there rejects an edited body, which is exactly
        // what this test edits — so the fixture now recomputes the body label
        // after doctoring, the way the compiler would. The property under test
        // is UNCHANGED (a row present only in the compiled blob proves the fast
        // path ran); what changed is that producing a servable compiled file
        // now takes both labels, which is the point of 2.3.
        const yaml = 'hosts:\n  probe:\n    surfaces:\n      any: {}\n';
        const doctored = JSON.parse(compile(yaml, 'host-lowering')) as Record<string, unknown>;
        (doctored['table'] as { hosts: Record<string, unknown> }).hosts['injected'] = {
            surfaces: { any: {} },
        };
        doctored['body_fingerprint'] = tableFingerprint(JSON.stringify(doctored['table']));
        const t = resolveTable(yaml, JSON.stringify(doctored));
        expect(t.has('injected')).toBe(true);
    });

    /**
     * road-to-blocking-severities 2.3 — the body, not only its label.
     *
     * The defect: `fingerprint` binds the compiled file to the YAML SOURCE, so
     * a compiled file whose `table` body was edited while that field was left
     * alone still matched and was still served. Every host would then be told
     * something the reviewed YAML beside it does not say, and nothing in the
     * tree would disagree.
     *
     * What this buys, stated precisely so nobody reads it as more: it closes
     * the PARTIAL edit — a hand edit, a bad merge, a truncated write — and it
     * does not resist someone who recomputes both labels, exactly as the
     * existing `fingerprint` does not. Paired with the tool-call deny added in
     * 2.2 and the ratification record added in 2.1, that is the same
     * deny-plus-record-plus-integrity shape the YAML sources already had.
     */
    it('falls back when the body was edited and the fingerprint label was not', () => {
        const compiled = JSON.parse(compile(YAML_TEXT, 'host-lowering')) as Record<string, unknown>;
        const hosts = (compiled['table'] as { hosts: Record<string, unknown> }).hosts;
        // One cell, the one that decides whether a refusal can land anywhere.
        const claude = hosts['claude'] as {
            surfaces: { any: { slots: Record<string, Record<string, unknown>> } };
        };
        const slot = claude.surfaces.any.slots['pre_tool_use'] as Record<string, unknown>;
        expect(slot['block_exit']).toBe(2);
        slot['block_exit'] = null;
        // The source label is deliberately left untouched — that is the defect.
        expect(compiled['fingerprint']).toBe(tableFingerprint(YAML_TEXT));

        const t = resolveTable(YAML_TEXT, JSON.stringify(compiled));
        // The YAML path, so the edited cell never reaches a caller.
        expect(tableShape(t)).toBe(tableShape(parseHostLowering(YAML_TEXT)));
        expect(t.get('claude')?.get('any')?.slots.get('pre_tool_use')?.block_exit).toBe(2);
    });

    it('falls back when the body label is absent altogether', () => {
        // A compiled file from before 2.3, or one written by something that
        // does not know about the field. Falling through is slow and correct;
        // serving it would reopen the hole the previous test closes.
        const compiled = JSON.parse(compile(YAML_TEXT, 'host-lowering')) as Record<string, unknown>;
        delete compiled['body_fingerprint'];
        const t = resolveTable(YAML_TEXT, JSON.stringify(compiled));
        expect(tableShape(t)).toBe(tableShape(parseHostLowering(YAML_TEXT)));
    });

    it('the compiler emits a body label the reader accepts — the round trip', () => {
        const compiled = JSON.parse(compile(YAML_TEXT, 'host-lowering')) as Record<string, unknown>;
        expect(typeof compiled['body_fingerprint']).toBe('string');
        expect(compiled['body_fingerprint']).toBe(
            tableFingerprint(JSON.stringify(compiled['table'])),
        );
    });
});

describe('tableFingerprint', () => {
    it('moves on a content change', () => {
        expect(tableFingerprint('a: 1\n')).not.toBe(tableFingerprint('a: 2\n'));
    });

    it('moves on a COMMENT-only change, which is why the gate row exists', () => {
        expect(tableFingerprint('# one\na: 1\n')).not.toBe(tableFingerprint('# two\na: 1\n'));
    });
});
