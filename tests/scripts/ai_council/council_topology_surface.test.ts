// Pins `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 12.1:
// "Keep `/council` as the main explicit user concept; users need no topology
// vocabulary."
//
// The step's verify line is "the command surface gains no topology argument for
// normal use". Today there is no topology selection at all, so the property holds
// vacuously — and a vacuous property is exactly the kind that regresses
// unnoticed. This file turns it into a falsifiable guard: the day a topology
// argument reaches the council command surface, one of these tests goes red.
//
// HONEST SCOPE. This is a naming-based shape gate over the CLI's own option
// tables, not a proof about what the command can express. A topology choice
// smuggled in under a name none of the patterns below anticipate escapes it —
// and it discharges the BASELINE half of 12.1 only: it says nothing about
// whether the constraint holds once topology selection exists, because there is
// nothing to select. That is why the step is `guarded-baseline` and not `[x]`.
// Per this repo's gate-authoring discipline the DENIAL is tested explicitly, so
// a zero above means something.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** The council command surface: the option tables plus the help text they print. */
const SURFACE = [
    path.join(REPO_ROOT, 'src', 'scripts', 'council_cli.ts'),
    path.join(REPO_ROOT, 'src', 'scripts', 'ai_council', 'cli_help.ts'),
];

/**
 * Fires on topology vocabulary. Kept as one exported-shaped constant so the
 * polarity tests below score the same detector the claim tests use — two regexes
 * would let them drift.
 *
 * Deliberately does NOT match the flags that already exist (`--single`,
 * `--debate`, `--rounds`, `--peer-review`): those are round and review controls
 * the surface has always carried, and a detector that reddened on them would be
 * measuring the wrong baseline.
 */
const TOPOLOGY_TERM_RE =
    /topolog|hub-and-spoke|fan-?out|round-robin|\bmesh\b|\bstar-shape|\bgraph-shape/i;

/** `{ flag: '--x', … }` — the declarative option table IS the argument surface. */
const FLAG_LITERAL_RE = /flag:[ \t]*'(--[a-z0-9-]+)'/g;
/** `choices: ['a', 'b']` — a topology could arrive as a value rather than a flag. */
const CHOICES_RE = /choices:[ \t]*\[([^\]]*)\]/g;

function readSurface(): string {
    return SURFACE.map((f) => readFileSync(f, 'utf8')).join('\n');
}

function declaredFlags(): string[] {
    const text = readSurface();
    return [...text.matchAll(FLAG_LITERAL_RE)].map((m) => m[1] as string);
}

function declaredChoices(): string[] {
    const text = readSurface();
    return [...text.matchAll(CHOICES_RE)].flatMap((m) =>
        (m[1] as string).split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, '')),
    );
}

describe('council command surface — no topology vocabulary for normal use', () => {
    it('the scan scope is non-empty (a gate that scans nothing exits green)', () => {
        expect(declaredFlags().length).toBeGreaterThan(20);
        expect(declaredChoices().length).toBeGreaterThan(5);
    });

    it('no declared flag names a topology', () => {
        expect(declaredFlags().filter((f) => TOPOLOGY_TERM_RE.test(f))).toEqual([]);
    });

    it('no declared option value names a topology', () => {
        expect(declaredChoices().filter((c) => TOPOLOGY_TERM_RE.test(c))).toEqual([]);
    });

    // Wider than the two tables above: a topology could arrive as a plain
    // `argv.includes('--topology')` outside the declarative option list. COMMENT
    // LINES ARE SKIPPED, and that exclusion is measured rather than defensive —
    // without it this test reds today on two prose uses of "fan-out" (`siblings
    // fan-out`, `subagent fan-out`) that are not arguments and never were. A gate
    // that reds on its own baseline's prose is measuring the wrong thing.
    it('no CODE line in the command surface names a topology concept', () => {
        const offenders: string[] = [];
        for (const file of SURFACE) {
            for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
                if (/^(\/\/|\*|\/\*)/.test(line.trim())) {
                    continue;
                }
                if (TOPOLOGY_TERM_RE.test(line)) {
                    offenders.push(`${path.relative(REPO_ROOT, file)}:${i + 1}: ${line.trim()}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    // POLARITY. Without this, the three zeros above are indistinguishable from a
    // detector that matches nothing at all.
    it.each([
        ['--topology', 'a topology flag'],
        ['--council-topology', 'a prefixed topology flag'],
        ['--fan-out', 'a fan-out flag'],
        ['--fanout', 'the unhyphenated spelling'],
        ['mesh', 'a topology given as an option VALUE'],
        ['round-robin', 'a rotation topology value'],
    ])('the detector fires on %s (%s)', (token) => {
        expect(TOPOLOGY_TERM_RE.test(token)).toBe(true);
    });

    it('the detector stays silent on the flags the surface already carries', () => {
        for (const flag of ['--depth', '--single', '--debate', '--rounds', '--peer-review', '--model']) {
            expect(TOPOLOGY_TERM_RE.test(flag), flag).toBe(false);
        }
    });
});
