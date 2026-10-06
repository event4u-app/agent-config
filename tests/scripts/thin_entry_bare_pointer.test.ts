// The stub's pointer is a PATH, not a link that repeats the id — step 2.3 of
// `road-to-a-thinned-layer-measured-in-one-unit`.
//
// The pointer used to read ``Body: [`<id>`](<prefix><id>.md)``: a markdown link
// whose visible text was the rule id the target already ends in. That is
// `6 + len(id)` characters per stub over the bare form — 2,359 across the 89
// stubs of the measured layer, of which 534 is pure link syntax and the rest is
// the id written a second time.
//
// Nothing followed it AS a link. Under `delivery` the hook loads the body and
// never reads the pointer; under `thin` an agent reads a path. Neither renders
// markdown, so the syntax bought rendering nobody was doing.
//
// The second half of the step is the detector. `probe_host_compliance` held its
// own regex for the link form, so a writer that stopped emitting brackets would
// have made that gate report every correct stub as missing its pointer — a red
// with no defect behind it, which is the shape that teaches a reader to ignore
// a gate.
import { describe, expect, it } from 'vitest';

import { evaluate_demotion } from '../../src/scripts/probe_host_compliance.js';
import {
    has_body_pointer,
    THIN_BODY_POINTER_PREFIX,
    THIN_BODY_POINTER_RE,
    THIN_ENTRY_MARKER,
    thin_entry,
} from '../../src/scripts/_lib/thin_rules.js';

const KEYWORD = 'kw-probe';
const SENTINEL = 'BODY_SENTINEL';
const PREFIX = '/pkg/dist/agent-src/rules/';

function sourceRule(id: string): string {
    return (
        '---\n' +
        'description: "A one-line summary that does not name the rule"\n' +
        'triggers:\n' +
        `  - keyword: "${KEYWORD}"\n` +
        '---\n' +
        `\n# ${id}\n\n${SENTINEL} and a body the stub replaces.\n`
    );
}

describe('the stub pointer is a bare path', () => {
    it('names the body path once, with no link syntax and no repeated id', () => {
        const stub = thin_entry('some-rule', sourceRule('some-rule'), PREFIX);
        expect(stub).toContain(`${THIN_BODY_POINTER_PREFIX}${PREFIX}some-rule.md`);
        expect(stub).not.toContain('](');
        expect(stub).not.toContain('[`');
        // Once, not twice — the saving is the id's second occurrence.
        expect(stub.split('some-rule').length - 1).toBe(1);
    });

    it('is shorter than the link form by exactly `6 + len(id)`', () => {
        for (const id of ['x', 'some-rule', 'a-considerably-longer-rule-id']) {
            const stub = thin_entry(id, sourceRule(id), PREFIX);
            const asLink = stub.replace(
                `${THIN_BODY_POINTER_PREFIX}${PREFIX}${id}.md`,
                `${THIN_BODY_POINTER_PREFIX}[\`${id}\`](${PREFIX}${id}.md)`,
            );
            expect(asLink.length - stub.length).toBe(6 + id.length);
        }
    });

    it('the WRITER and the DETECTOR agree on what a pointer is', () => {
        const stub = thin_entry('some-rule', sourceRule('some-rule'), PREFIX);
        expect(has_body_pointer(stub)).toBe(true);
        expect(
            evaluate_demotion(stub, { sentinel: SENTINEL, keyword: KEYWORD }).link_present,
        ).toBe(true);
    });

    it('an entry with no pointer is recognised as having none', () => {
        // The control. Without it the case above would pass for a detector that
        // answered true unconditionally.
        const noPointer = `## Some Rule\n${THIN_ENTRY_MARKER} Fires on: kw-probe.\n`;
        expect(has_body_pointer(noPointer)).toBe(false);
        expect(
            evaluate_demotion(noPointer, { sentinel: SENTINEL, keyword: KEYWORD }).link_present,
        ).toBe(false);
    });

    it('a package root containing a SPACE still reads as a pointer', () => {
        // Why the pattern is anchored to end of line rather than `\S+`: a root
        // under "My Projects" is ordinary on macOS and Windows, and a
        // whitespace-stopping pattern would call a correct stub malformed.
        const spaced = '/Users/x/My Projects/pkg/dist/agent-src/rules/';
        const stub = thin_entry('some-rule', sourceRule('some-rule'), spaced);
        expect(has_body_pointer(stub)).toBe(true);
        expect(THIN_BODY_POINTER_RE.exec(stub)?.[1]).toBe(`${spaced}some-rule.md`);
    });

    it('extraction captures the whole tail of the line, which is the path', () => {
        // The pattern EXTRACTS — `install_thin_layer`'s suite reads
        // `exec(...)[1]` as the body path — so what it captures is a
        // correctness property. A review round proposed a lazy `(.+?\.md)` to
        // stop at the first `.md`; this case is the measurement that shows it
        // changes nothing. `\s*$` forces the match to reach end of line, so a
        // lazy quantifier backtracks forward to exactly the same place.
        //
        // The behaviour is correct because the writer puts the pointer LAST on
        // its line: the tail IS the path. A stub is never emitted with trailing
        // prose after the pointer, which the first assertion below pins against
        // the writer itself.
        const stub = thin_entry('some-rule', sourceRule('some-rule'), PREFIX);
        expect(THIN_BODY_POINTER_RE.exec(stub)?.[1]).toBe(`${PREFIX}some-rule.md`);

        const twoOnOneLine = 'Body: /pkg/rules/first.md and later /pkg/rules/second.md\n';
        expect(THIN_BODY_POINTER_RE.exec(twoOnOneLine)?.[1]).toBe(
            '/pkg/rules/first.md and later /pkg/rules/second.md',
        );
    });

    it('a description carrying the literal `Body: ` does not capture itself', () => {
        // `thin_entry` puts the rule's own description on the SAME line ahead of
        // the pointer, so a description containing the prefix used to start the
        // match inside the description: `has_body_pointer` stayed true while the
        // captured "path" was the description plus the real path. A wrong
        // extraction read as a wrong assertion rather than a visible failure.
        //
        // Measured under the old `Body: (.+\.md)\s*$`, the line below captured
        // `the shape of a reply. Body: ../../rules/b.md`. The capture now
        // forbids a second prefix inside itself, which makes the first viable
        // start the LAST occurrence — the pointer.
        const line =
            '> Load the body on a match. Body: the shape of a reply. ' +
            'Body: ../../rules/b.md';
        expect(has_body_pointer(line)).toBe(true);
        expect(THIN_BODY_POINTER_RE.exec(line)?.[1]).toBe('../../rules/b.md');
    });

    it('the OLD link form no longer satisfies the detector unchanged', () => {
        // Stated as its own case because it is the thing a reader would assume
        // the opposite of: the pattern is not lenient enough to accept both
        // spellings, so a layer written by an older install reads as pointerless
        // until it is refreshed. That is the same known case the marker change
        // carries, and the install receipt already tells the user when a layer
        // was rewritten.
        const old = `## Some Rule\n${THIN_ENTRY_MARKER} Body: [\`x\`](rules/x.md)\n`;
        expect(has_body_pointer(old)).toBe(false);
    });
});
