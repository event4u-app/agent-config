#!/usr/bin/env tsx
/**
 * Score today's `apply` gates against the four planted arms.
 *
 * The point of this script is that it is the SAME command before and after the
 * gate changes, so the two `caught N of 3` numbers in `README.md` are
 * comparable. Its catch predicates are therefore written to be satisfiable by
 * either implementation — each asks whether the loss reached the operator, not
 * which code path carried it there. A predicate phrased as "returns BLOCKED
 * from `_halt_coverage`" would have been unrunnable before the fix and would
 * have made the before-number unmeasurable rather than zero.
 *
 * Run from anywhere:
 *
 *     npx tsx tests/design-artifacts/fixtures/ui-port-losses/probe.ts
 *
 * Exit code is 0 whatever the count. This is a measuring instrument, not a
 * gate: a non-zero exit would turn the pre-registered before-number into a red
 * build and nobody would ever record it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');

// `apply` resolves `ui_apply.files` against the working directory, the way the
// engine does when it runs at a consumer project root. Pin it so the arms'
// repo-relative paths resolve identically however the probe was invoked.
process.chdir(REPO);

const { DeliveryState } = await import(
    path.join(REPO, 'src/agent-src/templates/scripts/work_engine/delivery_state.js')
);
const { run } = await import(
    path.join(REPO, 'src/agent-src/templates/scripts/work_engine/directives/ui/apply.js')
);

type Arm = {
    id: string;
    file: string;
    /** Did the loss reach the operator at all? */
    caught: (text: string, outcome: string) => boolean;
};

function readJson(name: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(HERE, name), 'utf8')) as Record<string, unknown>;
}

const ARTIFACT = readJson('_artifact.json');

/** The confirmed five-key brief every arm shares, plus the provided artifact. */
function brief(): Record<string, unknown> {
    return {
        layout: 'one panel, tab-switched',
        components: ['tablist', 'disclosure', 'subscribe form'],
        states: {
            empty: 'no notes yet',
            loading: 'skeleton lines',
            error: 'could not load the notes',
            success: 'Filed.',
            disabled: 'submit disabled while filing',
        },
        microcopy: { submit: 'Send me the summary' },
        a11y: 'tablist exposes aria-selected; disclosure exposes aria-expanded',
        design_confirmed: true,
        provided_artifact: ARTIFACT,
    };
}

const ARMS: readonly Arm[] = [
    {
        id: 'S-a',
        file: 'S-a-substring-collision.json',
        // The declared item `tab` is the one thing no bucket accounts for.
        caught: (text, outcome) => outcome !== 'success' && /`tab`/.test(text),
    },
    {
        id: 'S-b',
        file: 'S-b-all-flagged.json',
        // Either the outcome stopped saying success, or the result says in
        // words that the port flagged everything. Both count as reaching the
        // operator; only silence is a miss.
        caught: (text, outcome) => outcome !== 'success' || /carried nothing/.test(text),
    },
    {
        id: 'S-c',
        file: 'S-c-placeholder-in-file.json',
        caught: (text, outcome) => outcome !== 'success' && /written\/S-c\/panel\.html/.test(text),
    },
];

function score(file: string): { outcome: string; text: string } {
    const arm = readJson(file);
    const state = new DeliveryState({
        ticket: { id: 'T-1', title: 'port the release-notes panel', ui_apply: arm['ui_apply'] },
        ui_design: brief(),
        stack: { frontend: 'plain' },
    });
    const r = run(state);
    return { outcome: String(r.outcome), text: [r.message, ...r.questions].join('\n') };
}

const rows: string[] = [];
let caught = 0;
for (const arm of ARMS) {
    const { outcome, text } = score(arm.file);
    const hit = arm.caught(text, outcome);
    if (hit) caught += 1;
    rows.push(`${arm.id}  ${hit ? 'CATCH' : 'MISS '}  outcome=${outcome}`);
}

const faithful = score('faithful.json');
const falseReds = faithful.outcome === 'success' ? 0 : 1;

process.stdout.write(`${rows.join('\n')}\n`);
process.stdout.write(`caught ${caught} of 3\n`);
process.stdout.write(`faithful arm: ${falseReds} false red(s), outcome=${faithful.outcome}\n`);
