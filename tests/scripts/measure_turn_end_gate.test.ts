/**
 * `measure_turn_end_gate` scoring detectors C, E and F over a transcript corpus.
 *
 * ADR-277 ships detector F with its false-positive rate unmeasured and names
 * that as an open limit. These cases assert the instrument that closes it reads
 * the population the SHIPPED gate reads — which is the only property that makes
 * the resulting number about the gate rather than about the instrument.
 *
 * The load-bearing case is the last pair: detector C silent while F fires. That
 * is the corpus form of the argument ADR-277 makes from a single unit test, so
 * if the two detectors ever converge, this is where it shows.
 *
 * Detector E arrived here on 2026-09-11, having been scored by nothing until
 * then. Its cases carry one extra weight the others do not: E reads the turn's
 * assistant TEXTS, an accumulation no other detector needs, so the turn boundary
 * has to be asserted on the array itself rather than inherited from the tool-call
 * reset that already has coverage. The case that matters is the tool-only entry —
 * the ordinary shape of every working turn, and the one that would make E fire
 * across the corpus if a text-free entry ever entered the array.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    editPathClass,
    emptyShadowStats,
    LANGUAGE_SPLIT_CLASSES,
    languageFireClass,
    languageSplit,
    measure,
    render,
    renderLanguageSplit,
    renderQ1,
    renderUnverifiedFires,
    type ShadowStats,
} from '../../src/scripts/measure_turn_end_gate.js';

let store: string;

beforeEach(() => {
    store = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-turn-end-'));
});

afterEach(() => {
    fs.rmSync(store, { recursive: true, force: true });
});

function userEntry(text: string): Record<string, unknown> {
    return { type: 'user', message: { role: 'user', content: text } };
}

/**
 * The ordinary Claude Code user entry: a typed prompt with a reminder block
 * appended. Not an exotic shape — it is the most common one in the store, which
 * is why a reader that skips it moves the turn boundary on nearly every turn.
 */
function userEntryWithReminder(text: string): Record<string, unknown> {
    return {
        type: 'user',
        message: {
            role: 'user',
            content: `${text}\n<system-reminder>\nsome injected context\n</system-reminder>`,
        },
    };
}

function toolEntry(name: string, input: Record<string, unknown>): Record<string, unknown> {
    return {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'tool_use', name, input }] },
    };
}

function replyEntry(text: string): Record<string, unknown> {
    return {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text }] },
    };
}

function writeSession(name: string, entries: Record<string, unknown>[]): void {
    fs.writeFileSync(
        path.join(store, `${name}.jsonl`),
        `${entries.map((e) => JSON.stringify(e)).join('\n')}\n`,
    );
}

describe('detector F over a corpus', () => {
    it('counts a turn that wrote production code, no test, and claimed done', () => {
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Done. The toggle is in place.'),
        ]);
        const c = measure(store, 30);
        expect(c.turns).toBe(1);
        expect(c.turns_with_edit).toBe(1);
        expect(c.untested_fires).toBe(1);
    });

    it('does not count the same turn once a test file is touched', () => {
        // The second of F's three conditions, isolated: everything else about
        // this turn is identical to the case above.
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            toolEntry('Write', { file_path: 'tests/Toggle.test.tsx' }),
            replyEntry('Done. The toggle is in place.'),
        ]);
        expect(measure(store, 30).untested_fires).toBe(0);
    });

    it('does not count a turn that claims nothing', () => {
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Fertig ist der Toggle noch nicht — der Test kommt als Nächstes.'),
        ]);
        expect(measure(store, 30).untested_fires).toBe(0);
    });

    it('scopes tool calls to their own turn, so a later turn is not charged', () => {
        // The reset the gate does at every genuine user prompt. Without it the
        // second turn inherits the first turn's edit and F fires on a reply that
        // changed nothing — which would make every trailing "done" a fire and
        // the published rate meaningless.
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Written.'),
            userEntry('what does it do?'),
            replyEntry('It toggles.\nDone.'),
        ]);
        const c = measure(store, 30);
        expect(c.turns).toBe(2);
        expect(c.untested_fires).toBe(0);
    });

    it('ignores a subagent’s own tool calls', () => {
        // A sidechain edit happened in another context. Charging the main
        // thread for it is the same class of error as the missing turn reset.
        writeSession('a', [
            userEntry('add the toggle'),
            { ...toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }), isSidechain: true },
            replyEntry('Done.'),
        ]);
        expect(measure(store, 30).untested_fires).toBe(0);
    });
});

describe('detector E over a corpus', () => {
    /** An ask: a numbered block plus the single recommendation line Iron Law 1 requires. */
    const ASKED = ['1. ship it', '2. measure first', '', 'Recommendation: 2'].join('\n');
    /** The closing reply that drops it — the measured failure, not an invented shape. */
    const DROPPED = 'The reviewer is through, no findings.';

    it('counts a turn that asked in one reply and closed without the ask', () => {
        writeSession('a', [userEntry('what next?'), replyEntry(ASKED), replyEntry(DROPPED)]);
        const c = measure(store, 30);
        expect(c.turns).toBe(1);
        expect(c.turns_multi_text).toBe(1);
        expect(c.dropped_fires).toBe(1);
    });

    it('is silent when the closing reply carries the ask forward', () => {
        writeSession('a', [userEntry('what next?'), replyEntry(ASKED), replyEntry(ASKED)]);
        expect(measure(store, 30).dropped_fires).toBe(0);
    });

    it('does not let a tool-only entry become a second assistant text', () => {
        // E's entire false-positive surface. A working turn is prose, tool call,
        // prose; if a text-free entry entered the array, every turn that asked
        // and then ran a command would read as a dropped ask. `assistantText`
        // returns null for it, exactly as the gate's `_messageText` does — this
        // asserts that rather than trusting the reading.
        writeSession('a', [
            userEntry('what next?'),
            replyEntry(ASKED),
            toolEntry('Bash', { command: 'npx vitest run' }),
        ]);
        const c = measure(store, 30);
        expect(c.turns_multi_text).toBe(0);
        expect(c.dropped_fires).toBe(0);
    });

    it('scopes the ask to its own turn, so a user answer ends it', () => {
        // The reset that makes "in the SAME user turn" true of the array rather
        // than merely intended. Without it the ask outlives the answer and every
        // later reply in the session reads as having dropped it.
        writeSession('a', [
            userEntry('what next?'),
            replyEntry(ASKED),
            userEntry('2'),
            replyEntry(DROPPED),
        ]);
        const c = measure(store, 30);
        expect(c.turns).toBe(2);
        expect(c.turns_multi_text).toBe(0);
        expect(c.dropped_fires).toBe(0);
    });

    it('ends the turn on a prompt carrying an appended reminder block', () => {
        // The gate nulls a user entry only when it has no text block and then
        // filters with `isSyntheticPrompt`, which matches the marker at the
        // START. A reader that nulls on the marker appearing ANYWHERE skips the
        // ordinary prompt, so the turn never resets and two genuine turns merge
        // into one — detector E then fires on an ask the user answered, while
        // the denominator it is divided by shrinks at the same time. Both
        // directions are asserted here, because a fire count alone would pass
        // with the turn count wrong.
        writeSession('a', [
            userEntryWithReminder('what next?'),
            replyEntry(ASKED),
            userEntryWithReminder('2'),
            replyEntry(DROPPED),
        ]);
        const c = measure(store, 30);
        expect(c.turns).toBe(2);
        expect(c.dropped_fires).toBe(0);
    });

    it('separates a fire inside a tool-bearing turn from one outside it', () => {
        // E was designed from a stop-hook nudge producing a second assistant
        // execution mid-turn, which is a tool-bearing shape. The split is the
        // only thing that says whether a corpus fire is the designed-for case or
        // a shape nothing predicted, so a single total would hide the question.
        writeSession('aaaaaaaa-1111', [
            userEntry('what next?'),
            replyEntry(ASKED),
            toolEntry('Bash', { command: 'npx eslint src' }),
            replyEntry(DROPPED),
        ]);
        writeSession('bbbbbbbb-2222', [userEntry('what next?'), replyEntry(ASKED), replyEntry(DROPPED)]);
        const c = measure(store, 30);
        expect(c.dropped_fires).toBe(2);
        expect(c.dropped_with_tool).toBe(1);
    });

    it('points at the fire with a per-session ordinal and a text-free evidence span', () => {
        // Same pointer contract F's sites carry: the option NUMBERS and the span,
        // never the option text, because the evidence is quoted into a refusal
        // that reaches the transcript.
        writeSession('cccccccc-3333', [
            userEntry('one'),
            replyEntry('Nothing to see.'),
            userEntry('what next?'),
            replyEntry(ASKED),
            replyEntry(DROPPED),
        ]);
        const c = measure(store, 30);
        expect(c.dropped_sites).toHaveLength(1);
        expect(c.dropped_sites[0]!.session).toBe('cccccccc');
        expect(c.dropped_sites[0]!.turn).toBe(2);
        expect(c.dropped_sites[0]!.evidence).toContain('1/2');
        expect(c.dropped_sites[0]!.evidence).not.toContain('measure first');
    });

    it('ignores a subagent’s own asks', () => {
        // A sidechain reply happened in another context, so an ask inside it was
        // never put to this user — the same exclusion the tool-call path makes.
        writeSession('a', [
            userEntry('what next?'),
            { ...replyEntry(ASKED), isSidechain: true },
            replyEntry(DROPPED),
        ]);
        expect(measure(store, 30).dropped_fires).toBe(0);
    });
});

describe('the C-silent overlap ADR-277 argues from', () => {
    it('records F firing while C stays silent when a linter ran', () => {
        // The audit's central claim: `npx eslint src` satisfies detector C's
        // "did anything verify" question and says nothing about whether the
        // change is tested. If this ever reads 0, ADR-277's "two different
        // questions deserve two detectors" is refuted and the record reopens.
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            toolEntry('Bash', { command: 'npx eslint src' }),
            replyEntry('Done. Lint is clean.'),
        ]);
        const c = measure(store, 30);
        expect(c.untested_fires).toBe(1);
        expect(c.unverified_fires).toBe(0);
        expect(c.untested_c_silent).toBe(1);
    });

    it('points at the fire with a PER-SESSION turn ordinal', () => {
        // The corpus-wide running total was the first label here, and it sent a
        // reader to turn 17 of a session whose fire was on turn 6. A pointer
        // that resolves to the wrong turn is worse than none: it reads as a
        // verified location.
        writeSession('aaaaaaaa-1111', [
            userEntry('one'),
            replyEntry('Nothing to see.'),
            userEntry('two'),
            replyEntry('Still nothing.'),
        ]);
        writeSession('bbbbbbbb-2222', [
            userEntry('first'),
            replyEntry('Looking.'),
            userEntry('now build it'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Done.'),
        ]);
        const c = measure(store, 30);
        expect(c.turns).toBe(4);
        expect(c.untested_sites).toHaveLength(1);
        // `sessionId` is the filename's first 8 chars, as the sibling scanner
        // keys it — the fixture names are UUID-shaped so the slice means here
        // what it means over a real store.
        expect(c.untested_sites[0]!.session).toBe('bbbbbbbb');
        expect(c.untested_sites[0]!.turn).toBe(2);
    });

    it('does not count the overlap when C fired too', () => {
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Done.'),
        ]);
        const c = measure(store, 30);
        expect(c.untested_fires).toBe(1);
        expect(c.unverified_fires).toBe(1);
        expect(c.untested_c_silent).toBe(0);
    });
});

describe('detector C by edited-path class — road-to-agent-throughput-recovery 4.2', () => {
    it('classifies agents/** and docs/** markdown apart from code', () => {
        expect(editPathClass(['/repo/agents/notes/x.md', 'docs/a.md'])).toBe('docs-md');
        expect(editPathClass(['src/a.ts'])).toBe('code');
        expect(editPathClass(['src/rules/x.md'])).toBe('code');
        expect(editPathClass(['agents/notes/x.md', 'src/a.ts'])).toBe('mixed');
        expect(editPathClass([])).toBe('unknown');
    });

    it('with the session root known, only root-level agents/ and docs/ markdown is docs', () => {
        expect(editPathClass(['/repo/agents/x.md', 'docs/a.md'], '/repo')).toBe('docs-md');
        for (const p of ['/repo/src/agents/x.md', '/repo/node_modules/pkg/docs/y.md', '/repo/tests/fixtures/docs/z.md', '/elsewhere/docs/a.md', 'src/agents/x.md']) {
            expect(editPathClass([p], '/repo'), p).toBe('code');
        }
    });

    it('splits every C fire into exactly one class, and the rows sum to the fires', () => {
        writeSession('aaaaaaaa-1', [
            userEntry('write the roadmap'),
            toolEntry('Write', { file_path: '/repo/agents/notes/plan.md' }),
            replyEntry('Written.'),
            userEntry('fix the code'),
            toolEntry('Edit', { file_path: '/repo/src/scripts/x.ts' }),
            replyEntry('Fixed.'),
            userEntry('both'),
            toolEntry('Edit', { file_path: '/repo/docs/guide.md' }),
            toolEntry('Edit', { file_path: '/repo/src/scripts/y.ts' }),
            replyEntry('Both done.'),
            userEntry('docs again, verified'),
            toolEntry('Edit', { file_path: '/repo/docs/guide.md' }),
            toolEntry('Bash', { command: 'npx vitest run tests/x.test.ts' }),
            replyEntry('Verified.'),
        ]);
        const c = measure(store, 30);
        expect(c.unverified_fires).toBe(3);
        expect(c.unverified_by_path_class).toEqual({ 'docs-md': 1, code: 1, mixed: 1, unknown: 0 });
        const sum = Object.values(c.unverified_by_path_class).reduce((a, b) => a + b, 0);
        expect(sum).toBe(c.unverified_fires);
        expect(c.unverified_sites.map((x) => [x.turn, x.path_class])).toEqual([
            [1, 'docs-md'],
            [2, 'code'],
            [3, 'mixed'],
        ]);
    });

    it('prints the split and a path-free pointer per fire', () => {
        writeSession('aaaaaaaa-1', [
            userEntry('write the roadmap'),
            toolEntry('Write', { file_path: '/home/someone/repo/agents/notes/plan.md' }),
            replyEntry('Written.'),
        ]);
        const c = measure(store, 30);
        expect(render(c)).toMatch(/docs-md +1/);
        const fires = renderUnverifiedFires(c);
        expect(fires).toContain('aaaaaaaa turn 1 — docs-md');
        expect(fires).not.toContain('someone');
    });
});

describe('renderQ1 — step 2.2, the reader the contract was waiting on', () => {
    function stats(over: Partial<ShadowStats> = {}): ShadowStats {
        return { ...emptyShadowStats(), ...over };
    }

    function withLayer(
        layer: 'stop_hook_active' | 'refused_turn',
        retries: number,
        rows: Partial<Record<string, number>>,
    ): ShadowStats {
        const s = emptyShadowStats();
        const bucket = s.byLayer.find((b) => b.layer === layer)!;
        bucket.retries = retries;
        for (const [det, n] of Object.entries(rows)) {
            bucket.byDetector[det as keyof typeof bucket.byDetector] = n!;
            bucket.rows += n!;
        }
        s.files = 1;
        return s;
    }

    it('prints an em dash, NEVER 0.0%, where the layer has no denominator', () => {
        // The one way the null/zero distinction `q1For` maintains can be undone
        // one line before a human reads it. Zero is a finding about the
        // detector; the dash is a finding about the sample.
        const out = renderQ1(withLayer('stop_hook_active', 2, { language: 0 }), '2026-10-01');
        const refusedBlock = out.slice(out.indexOf('layer refused_turn'));
        expect(refusedBlock).toContain('—');
        expect(refusedBlock).not.toContain('0.0%');
        // …while the layer that DID observe retries prints a real zero.
        const stopBlock = out.slice(out.indexOf('layer stop_hook_active'), out.indexOf('layer refused_turn'));
        expect(stopBlock).toContain('0.0%');
    });

    it('prints each layer separately and never a pooled share', () => {
        const s = emptyShadowStats();
        s.files = 1;
        const stop = s.byLayer.find((b) => b.layer === 'stop_hook_active')!;
        stop.retries = 4;
        stop.byDetector.language = 1;
        stop.rows = 1;
        const refused = s.byLayer.find((b) => b.layer === 'refused_turn')!;
        refused.retries = 4;
        // `verification`, not `promissory`: the latter is dispatch-censored
        // since the 2026-10-01 review and prints no number at all.
        refused.byDetector.verification = 2;
        refused.rows = 2;
        const out = renderQ1(s, '2026-10-01');
        // 1/4 and 2/4, never the pooled 3/8 = 37.5%.
        expect(out).toContain('25.0%');
        expect(out).toContain('50.0%');
        expect(out).not.toContain('37.5%');
    });

    it('censors the three detectors an open dispatch suppresses, and prints no share for them', () => {
        // M2 of the 2026-10-01 review. `runDetectors` skips promissory,
        // completion and untested when a dispatch is open; the shadow record
        // carries no dispatch flag, so a suppressed retry would enter their
        // denominators as an observation of silence nobody made. The contract's
        // attribution clause forbids reporting a detector a rollup cannot
        // separate that way — so they print `censored`, never `0.0%`.
        const s = withLayer('stop_hook_active', 4, { language: 1 });
        const out = renderQ1(s, '2026-10-01');
        for (const id of ['promissory', 'completion', 'untested']) {
            const row = out.split('\n').find((l) => l.trim().startsWith(id));
            expect(row, `${id} must have a row`).toBeDefined();
            expect(row).toContain('censored');
            expect(row).not.toContain('%');
        }
        // …while a detector the gate runs unconditionally still reports.
        const lang = out.split('\n').find((l) => l.trim().startsWith('language'));
        expect(lang).toContain('25.0%');
    });

    it('prints the resolved workspace it read, so a published reading names its directory', () => {
        // M4. `--workspace` takes any path and a worktree carries no
        // `agents/runtime/`, so the report for a wrong directory is a confident
        // "no readable shadow record". 2.3 pastes this output verbatim into an
        // evidence file; without this line that file records no provenance.
        const out = renderQ1(emptyShadowStats(), '2026-10-01', '.');
        expect(out).toContain(`workspace: ${path.resolve('.')}`);
        // Absent is still allowed — the header simply carries no workspace line
        // rather than inventing one.
        expect(renderQ1(emptyShadowStats(), '2026-10-01')).not.toContain('workspace:');
    });

    it('prints a bare dash where there is no denominator, with no count beside it', () => {
        // m3. A dash denies a measurement; `(0 / 0)` beside it reads like one.
        const out = renderQ1(withLayer('stop_hook_active', 2, { language: 0 }), '2026-10-01');
        const refusedBlock = out.slice(out.indexOf('layer refused_turn'));
        expect(refusedBlock).toContain('—');
        expect(refusedBlock).not.toContain('(0 / 0)');
    });

    it('says an unreadable file is a defect rather than an empty sample', () => {
        // m2. "No record" and "N files present but unreadable" in the same
        // report were flatly contradictory.
        const s = emptyShadowStats();
        s.unreadable = 3;
        const out = renderQ1(s, '2026-10-01');
        expect(out).toContain('No readable shadow record');
        expect(out).toContain('UNREADABLE');
        expect(out).toContain('defect to');
    });

    it('agrees with itself about singular and plural', () => {
        // m4. "1 shadow records", "1 retries observed".
        const one = renderQ1(withLayer('stop_hook_active', 1, { language: 1 }), '2026-10-01');
        expect(one).toContain('1 shadow record ');
        expect(one).toContain('1 retry observed');
        expect(one).toContain('1 shadow row');
        const many = renderQ1(withLayer('stop_hook_active', 2, { language: 2 }), '2026-10-01');
        expect(many).toContain('2 retries observed');
        expect(many).toContain('2 shadow rows');
    });

    it('degrades rather than throwing on a ShadowStats missing a layer', () => {
        // m5. `byLayer.find(...)!` on an exported function threw for a
        // hand-built value; a renderer is not a place to assert.
        const s = emptyShadowStats();
        s.files = 1;
        s.byLayer = s.byLayer.filter((b) => b.layer === 'stop_hook_active');
        expect(() => renderQ1(s, '2026-10-01')).not.toThrow();
        expect(renderQ1(s, '2026-10-01')).toContain('layer stop_hook_active');
    });

    it('states in its own header that this is NOT the contract Q1', () => {
        // M1, the finding that renamed the quantity. The two condition on
        // different things, disagree in direction, and neither bounds the
        // other — so a reader must not carry a number here to a bar.
        const out = renderQ1(withLayer('stop_hook_active', 4, { language: 1 }), '2026-10-01');
        const header = out.split('\n').slice(0, 3).join('\n');
        expect(header).toContain('retry-conditioned');
        expect(header).toContain('NOT the Q1');
        expect(out).toContain('may be read against a bar');
    });

    it('refuses to report a zero when there is no record at all', () => {
        // "No shadow record" and "every retry came back clean" are opposite
        // readings. A report printing 0.0% across the board for the first is
        // the inert-Q1 problem with a number painted over it.
        const out = renderQ1(stats(), '2026-10-01');
        expect(out).toContain('No readable shadow record');
        expect(out).not.toContain('0.0%');
    });

    it('says every numerator is a floor when rows hit the per-session cap', () => {
        const s = withLayer('stop_hook_active', 5, { language: 1 });
        s.dropped = 7;
        expect(renderQ1(s, '2026-10-01')).toContain('FLOOR');
    });

    it('publishes both instrument bounds beside the number', () => {
        // The blocker `q1-shadow-reading-window` requires these two travel with
        // the reading. A number published without them reads as a point
        // estimate over sessions, and it is neither.
        const out = renderQ1(withLayer('stop_hook_active', 3, { language: 1 }), '2026-10-01');
        expect(out).toContain('UPPER bound');
        expect(out).toContain('session_id');
    });
});

/**
 * `--language-split` — road-to-a-language-pin-from-owner-prose 1.1.
 *
 * Every replayed `language` fire is charged to the entry that last set the pin,
 * by that entry's shape. The fixtures are the § Context shapes of the roadmap,
 * one session per class so no pin leaks from one class into another.
 */
describe('language-split', () => {
    const GERMAN_REPLY =
        'Ich habe die Datei geprüft und die Tests laufen jetzt wieder, das war ein Fehler in der Konfiguration.';
    const ENGLISH_REPLY =
        'I checked the file and the tests are passing again; the problem was in the configuration that we changed.';

    function metaEntry(text: string): Record<string, unknown> {
        return { type: 'user', isMeta: true, message: { role: 'user', content: text } };
    }

    function writeClassFixtures(): void {
        // owner-prose: the owner typed German, the reply is English.
        writeSession('owner', [
            userEntry('Bitte prüfe das und mach dann weiter mit den Tests.'),
            replyEntry(ENGLISH_REPLY),
        ]);
        // synthetic-turn: a host-written entry (`isMeta`) sets the pin.
        writeSession('synthetic', [
            userEntry('Bitte prüfe das und mach dann weiter mit den Tests.'),
            replyEntry(GERMAN_REPLY),
            metaEntry(
                'Stop hook feedback:\nThe reply should state what was verified and which tests were run before the turn ends.',
            ),
            replyEntry(GERMAN_REPLY),
        ]);
        // paste-decided: a short English lead over an unmarked German paste.
        writeSession('paste', [
            userEntry(
                'Fix this file.\n\nDer Parser verwirft die letzte Zeile, wenn die Eingabe keinen Zeilenumbruch hat, und die Tests sollten das auch abdecken.',
            ),
            replyEntry(ENGLISH_REPLY),
        ]);
        // trailing-typed-line: a terminal block first, the owner's line below it.
        writeSession('trailing', [
            userEntry(
                "The command failed with these errors and the build should be checked:\nError: Cannot find module './x.js'\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1145:15)\n\nWarum ist das rot?",
            ),
            replyEntry(GERMAN_REPLY),
        ]);
        // system-locale: nothing determinable typed, the locale answers.
        writeSession('locale', [userEntry('ok'), replyEntry(ENGLISH_REPLY)]);
    }

    it('with the owner-prose classifier, only owner prose and the locale still pin a refusal', () => {
        // The replay uses the shipped `classify`, so these are post-fix
        // numbers: a paste, a host entry and a line below a paste no longer
        // decide the pin. The two locale fires are the sessions whose owner
        // text is under the floor; the gate stops refusing on them in 4.1.
        writeClassFixtures();
        const split = languageSplit([store], { locale: 'de' });
        expect(split.sessions).toBe(5);
        expect(split.byClass).toEqual({
            'owner-prose': 1,
            'synthetic-turn': 0,
            'paste-decided': 0,
            'trailing-typed-line': 0,
            'system-locale': 2,
            unknown: 0,
        });
        const sum = LANGUAGE_SPLIT_CLASSES.reduce((n, k) => n + split.byClass[k], 0);
        expect(sum).toBe(split.fires);
    });

    it('the all-entries instrument still pins from a host-marked entry (D3), live-input does not (D6)', () => {
        writeSession('meta', [
            userEntry('Bitte prüfe das und mach dann weiter mit den Tests.'),
            replyEntry(GERMAN_REPLY),
            metaEntry(
                'Base directory for this skill: the files that are listed here should be read before the work starts, and this is what they are for.',
            ),
            replyEntry(GERMAN_REPLY),
        ]);
        expect(languageSplit([store], { instrument: 'all-entries' }).byClass['synthetic-turn']).toBe(1);
        expect(languageSplit([store], {}).fires).toBe(0);
    });

    it('charges each setter shape to its class', () => {
        const prompt = (text: string, language: 'de' | 'en') =>
            ({ flagged: false, text, language, source: 'prompt' }) as const;
        expect(
            languageFireClass({ ...prompt('Bitte prüfe das und mach dann weiter mit den Tests.', 'en'), source: 'system-locale' }),
        ).toBe('system-locale');
        expect(languageFireClass({ ...prompt('The reply should state what was verified and why.', 'en'), flagged: true })).toBe(
            'synthetic-turn',
        );
        expect(languageFireClass(prompt('Bitte prüfe das und mach dann weiter mit den Tests.', 'de'))).toBe('owner-prose');
        expect(
            languageFireClass(
                prompt(
                    "The command failed with these errors and the build should be checked:\nError: Cannot find module './x.js'\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1145:15)\n\nWarum ist das rot?",
                    'en',
                ),
            ),
        ).toBe('trailing-typed-line');
        expect(
            languageFireClass(
                prompt(
                    'Fix this file.\n\nDer Parser verwirft die letzte Zeile, wenn die Eingabe keinen Zeilenumbruch hat, und die Tests sollten das auch abdecken.',
                    'de',
                ),
            ),
        ).toBe('paste-decided');
    });

    it('lists owner-prose fires by session digest, never by text', () => {
        writeClassFixtures();
        const split = languageSplit([store], { locale: 'de' });
        expect(split.ownerProseSites).toHaveLength(1);
        expect(split.ownerProseSites[0]?.session).toMatch(/^[0-9a-f]{12}$/);
    });

    it('charges a fire with no recoverable setter to unknown', () => {
        expect(languageFireClass(null)).toBe('unknown');
    });

    it('counts only entries inside the window', () => {
        writeSession('dated', [
            { ...userEntry('Bitte prüfe das und mach dann weiter mit den Tests.'), timestamp: '2026-11-01T10:00:00Z' },
            { ...replyEntry(ENGLISH_REPLY), timestamp: '2026-11-01T10:01:00Z' },
            { ...userEntry('Bitte prüfe das und mach dann weiter mit den Tests.'), timestamp: '2026-11-05T10:00:00Z' },
            { ...replyEntry(ENGLISH_REPLY), timestamp: '2026-11-05T10:01:00Z' },
        ]);
        const split = languageSplit([store], { since: '2026-11-03T00:00:00Z', until: '2026-11-21T00:00:00Z' });
        expect(split.fires).toBe(1);
    });

    it('counts the refusals the gate itself recorded in the window', () => {
        writeSession('recorded', [
            userEntry('Bitte prüfe das und mach dann weiter mit den Tests.'),
            replyEntry(ENGLISH_REPLY),
            metaEntry('Stop hook feedback:\n[turn-end-gate] language: the pinned reply language is "de" but the reply classifies as "en"'),
        ]);
        expect(languageSplit([store], {}).recordedRefusals).toBe(1);
    });

    it('renders one table row per class, the command line and the tree sha, and no prompt text', () => {
        writeClassFixtures();
        const out = renderLanguageSplit(languageSplit([store], { locale: 'de' }), {
            command: './scripts-run src/scripts/measure_turn_end_gate --language-split',
            treeSha: 'abc1234',
        });
        expect(out.startsWith('<!-- evidence-type: analysis -->\n')).toBe(true);
        expect(out).toContain('abc1234');
        expect(out).toContain('--language-split');
        for (const k of LANGUAGE_SPLIT_CLASSES) {
            expect(out).toMatch(new RegExp(`^\\| ${k} \\| \\d+ \\|$`, 'm'));
        }
        expect(out).not.toContain('Bitte prüfe');
    });
});
