// One spelling of the stub marker — step 2.1 of
// `road-to-a-thinned-layer-measured-in-one-unit`.
//
// `THIN_ENTRY_MARKER` carries its own warning: "a gate that re-spelled this
// string would drift from the writer silently". Two gates had re-spelled it —
// `probe_host_compliance` and `_cli/cmd_conformance` each held a SUBSTRING of
// the sentence, without the blockquote prefix and the full stop. That is the
// worst available shape: a substring keeps matching after the writer is
// shortened at either end, so the drift is invisible until the day the shared
// middle changes, and then it fails in the direction where a stub a detector
// does not recognise reads as a complete rule body.
//
// The second case is the one that would have caught it: it changes what the
// writer emits and asserts BOTH detectors follow. A detector holding its own
// copy fails there and passes everywhere else.
import * as fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { evaluate_demotion } from '../../src/scripts/probe_host_compliance.js';
import { THIN_STUB_MARKER } from '../../src/scripts/_cli/cmd_conformance.js';
import {
    is_thin_entry,
    THIN_ENTRY_MARKER,
    thin_entry,
} from '../../src/scripts/_lib/thin_rules.js';

const SENTINEL = 'CANARY_BODY_SENTINEL_DO_NOT_INLINE';
const KEYWORD = 'xyzzy-canary-probe';

/** A rule as `dist/agent-src/rules/` carries it, with a body a stub must drop. */
function sourceRule(id: string): string {
    return (
        '---\n' +
        `description: "What ${id} is for"\n` +
        'triggers:\n' +
        `  - keyword: "${KEYWORD}"\n` +
        '---\n' +
        `\n# ${id}\n\n${SENTINEL} and a long body the stub replaces.\n`
    );
}

/** The stub the WRITER emits — never a hand-written imitation of one. */
function stubFor(id: string): string {
    return thin_entry(id, sourceRule(id), '/pkg/dist/agent-src/rules/');
}

describe('the stub marker has one writer and no second spelling', () => {
    it('every detector recognises a stub the writer actually emitted', () => {
        const stub = stubFor('some-routed-rule');

        // The writer's own predicate.
        expect(is_thin_entry(stub)).toBe(true);
        // The host-compliance probe.
        expect(
            evaluate_demotion(stub, { sentinel: SENTINEL, keyword: KEYWORD }).pointer_present,
        ).toBe(true);
        // The conformance verb, which tests by substring against its constant.
        expect(stub.includes(THIN_STUB_MARKER)).toBe(true);
    });

    it('no detector mistakes a full rule BODY for a stub', () => {
        // The other direction, and the one that matters for the shortening of
        // step 2.2: a marker short enough to occur inside ordinary rule prose
        // would make every rule read as a stub.
        const body = sourceRule('some-routed-rule');
        expect(is_thin_entry(body)).toBe(false);
        expect(
            evaluate_demotion(body, { sentinel: SENTINEL, keyword: KEYWORD }).pointer_present,
        ).toBe(false);
        expect(body.includes(THIN_STUB_MARKER)).toBe(false);
    });

    it('CHANGING THE CONSTANT moves every detector with it', () => {
        // The case a re-spelled detector fails. Nothing here asserts the text
        // of the marker: each detector is asked about a stub built from
        // whatever the writer currently emits, so a detector that kept its own
        // literal would stop matching the moment the two diverge.
        const stub = stubFor('another-routed-rule');
        expect(stub).toContain(THIN_ENTRY_MARKER);
        expect(THIN_STUB_MARKER).toBe(THIN_ENTRY_MARKER);

        // And a stub carrying a DIFFERENT marker is recognised by none of them,
        // which is what makes the equality above load-bearing rather than
        // decorative.
        const stale = stub.replace(THIN_ENTRY_MARKER, '> Pointer entry — body elsewhere.');
        expect(is_thin_entry(stale)).toBe(false);
        expect(
            evaluate_demotion(stale, { sentinel: SENTINEL, keyword: KEYWORD }).pointer_present,
        ).toBe(false);
        expect(stale.includes(THIN_STUB_MARKER)).toBe(false);
    });

    it('the marker occurs in NO rule body in the source corpus', () => {
        // AC-2's direction, asserted here on the live corpus rather than on a
        // fixture: the marker must not be a phrase a rule happens to contain.
        // A control first, so an empty result is a finding rather than a
        // broken search.
        const dir = new URL('../../src/rules/', import.meta.url);
        const names = fs.readdirSync(dir).filter((n: string) => n.endsWith('.md'));
        expect(names.length, 'the control: src/rules/ has rule files to search').toBeGreaterThan(
            50,
        );
        const hits = names.filter((n: string) =>
            fs.readFileSync(new URL(n, dir), 'utf-8').includes(THIN_ENTRY_MARKER),
        );
        expect(hits).toEqual([]);
    });
});
