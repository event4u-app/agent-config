/**
 * `agent-config gates --execute <id>` — the acting half of the gate layer.
 *
 * `gates` renders decisions. This resolves the ones that were never decisions:
 * a class-0 gate is a command whose OUTPUT IS THE UNBLOCK, and leaving it for a
 * human to type is the couriering `road-to-gate-autonomy` exists to remove.
 *
 * ## Deliberately thin, on the sweep's own number
 *
 * Step 1.2 pre-registered that at least 40 % of open blockers would be class 0
 * or 1 and measured **24.5 %** (`agents/evidence/analysis/gate-class-sweep-2026-08-17.md`).
 * The roadmap's honest-null clause then fixes this module's size: it ships for
 * the six class-0 entries and the render path, and it is not the lever that
 * drains the estate. Building a general execution engine against a premise the
 * evidence weakened would be the over-build the null exists to prevent.
 *
 * ## What it will not do
 *
 *   - **No sweep.** One blocker per invocation, named explicitly. A blanket
 *     `--execute` over the estate would run N authored commands on one keypress,
 *     and the blast radius of a misclassification would be the whole tree
 *     instead of one entry.
 *   - **No resolve on failure.** A non-zero exit reports and changes nothing.
 *     A gate marked resolved by a command that failed is worse than an open one.
 *   - **No spend outside the standing budget.** Class 1 runs only under the
 *     caps `b-gate-budget-preauth` decided (option (a), 2026-08-20): a per-run
 *     cap AND a rolling-7-day cap, with an append-only receipt as the audit
 *     surface. No caps configured, no USD estimate in the entry, over either
 *     cap — every one of those RENDERS instead of running, which is the
 *     behaviour the blocker itself prescribes for a missing ledger.
 *   - **No consent from the ledger.** The receipt records CONSUMPTION only.
 *     `agents/runtime/state/` is agent-writable, so reading an "authorisation"
 *     out of it would be the agent consenting on the user's behalf — the exact
 *     threat model the live-trigger-eval terminal abort exists for. `--confirm`
 *     remains the consent on every class-1 run.
 *   - **No class-3 change.** The class-3 branch executes nothing and writes
 *     nothing, so `agent-config gates` renders a class-3 entry exactly as it did
 *     before this module existed. `--execute` on one returns a one-line notice
 *     and points back at that renderer; it does not call it.
 *   - **No run without `--confirm`.** `Run:` is arbitrary shell read out of a
 *     markdown field. Without the flag the command is echoed and refused, so
 *     the operator sees the exact string first — the this-turn, names-the-object
 *     confirmation `non-destructive-by-default` requires. A command carrying a
 *     Hard-Floor action is refused even WITH the flag: classes 0 and 1 are both
 *     defined as reversible, so such an entry is misclassified rather than
 *     merely dangerous.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

import { collect, blocker_class, type Blocker } from './update_roadmap_progress.js';
import {
    appendGateBudgetReceipt,
    evaluateGateBudget,
    GATE_BUDGET_LEDGER_REL,
    parseBudgetUsd,
    readGateBudgetCaps,
    readGateBudgetLedger,
} from './gate_budget.js';
import { load_agent_settings } from '../templates/scripts/work_engine/_lib/agent_settings.js';

/**
 * Where the class-1 receipt ledger lives.
 *
 * Kept as a name here because it was already exported, but the definition
 * moved to `gate_budget.ts` when the budget decision landed — one path, one
 * builder, so a relocation cannot leave a second joiner behind.
 */
const LEDGER_REL = GATE_BUDGET_LEDGER_REL;

type Outcome = 'resolved' | 'failed' | 'rendered' | 'not-found';

interface ExecuteResult {
    outcome: Outcome;
    /** Human-facing report — always populated, always the whole answer. */
    report: string;
    /** Exit code for the CLI: 0 unless the gate was named and could not run. */
    code: number;
}

interface Located {
    blocker: Blocker;
    /** Absolute path of the roadmap holding it. */
    file: string;
    rel: string;
}

function locate(roadmapRoot: string, id: string): Located | null {
    for (const r of collect(roadmapRoot)) {
        for (const b of r.open_blockers) {
            if (b.id === id) {
                // `r.path` is the absolute path the collector already resolved.
                // Rebuilding it from `basename(r.rel)` discarded the directory,
                // so a roadmap in any subdirectory the collector does not
                // exclude was either written to a same-named top-level file or
                // threw — and either way AFTER the authored command had run.
                return { blocker: b, file: r.path, rel: r.rel };
            }
        }
    }
    return null;
}

/**
 * Commands a class-0 gate may never carry, whatever the entry claims.
 *
 * Class 0 is defined as deterministic, free and **reversible**. A command that
 * pushes, merges, deploys, or deletes is none of those, so its presence is a
 * misclassification — and the right answer to a misclassification is refusal,
 * not a confirmation prompt that makes the operator the last line of defence.
 * These are Hard-Floor actions under `non-destructive-by-default`, which no
 * setting, roadmap or flag lifts.
 *
 * A denylist is the wrong shape for a *security boundary* and the right shape
 * for a *classification check*, which is what this is: the tree's roadmap files
 * are reviewed content, so this catches the authoring mistake rather than an
 * attacker. The blast-radius control is `--confirm` below, not this list.
 */
const HARD_FLOOR_RE =
    /(^|[;&|]\s*)(git\s+(?:push|merge|reset\s+--hard|rebase)\b|gh\s+(?:pr\s+merge|release)\b|terraform\s+apply\b|kubectl\s+apply\b|npm\s+publish\b|rm\s+-[rRf]+|DROP\s+TABLE\b|TRUNCATE\b)/i;

function hardFloorReason(command: string): string | null {
    const m = HARD_FLOOR_RE.exec(command);
    return m ? (m[2] as string).trim() : null;
}

/** Strip the backticks an authored `Run:` field carries. */
function commandOf(b: Blocker): string {
    const raw = b.run.trim();
    const fenced = /^`([^`]+)`$/.exec(raw);
    return (fenced ? (fenced[1] as string) : raw).trim();
}

/**
 * The class-2 consent line — one question, its recommendation, its default.
 *
 * This is a FEED, not a surface: `road-to-user-out-of-the-loop` Phase 1 owns
 * the decision sheet, and this roadmap only hands it a line. Keeping the shape
 * to one line is the contract — a class-2 gate that cannot state a one-line
 * question and a default is reclassified to 3, never verbosified.
 */
function consentLine(b: Blocker, why?: string): string {
    const head = why ? `${b.id} — ${why}` : b.id;
    const rec = b.recommendation.trim();
    const q = b.question.trim();
    const lines = [`CONSENT · ${head}`];
    // An entry with no `Question:` has no question, and borrowing `Blocks:`
    // silently put a "what this holds up" sentence in the "what is being
    // decided" slot — two different facts. Say which one is on screen.
    lines.push(
        q !== ''
            ? `  Question:       ${q}`
            : `  Question:       (none authored — this is the Blocks line) ${b.blocks.trim()}`,
    );
    lines.push(
        `  Recommendation: ${rec || '(none recorded — ask for one before deciding)'}`,
    );
    // The default is derived, not constant: an entry carrying a recommendation
    // has one, an entry without one has nothing to default TO, and printing
    // the same sentence for both told the reader nothing either way.
    lines.push(
        rec !== ''
            ? '  Default if you say nothing: the recommendation above is NOT applied; the gate stays open.'
            : '  Default if you say nothing: the gate stays open, and no recommendation exists to fall back on.',
    );
    // Risk 5 of the roadmap, made observable rather than merely written down:
    // the defect being fixed is reading load, and a mechanism that emits
    // paragraphs recreates it under a new name. The remedy the taxonomy names
    // is reclassification to 3, never a longer line — so the overflow is
    // reported at the entry rather than silently rendered.
    if (rec.length > PARAGRAPH_CHARS) {
        lines.push(
            `  note: this recommendation is ${rec.length} chars — a class-2 gate that ` +
                'cannot state a one-line question and a default is reclassified to 3, ' +
                'not verbosified.',
        );
    }
    return lines.join('\n') + '\n';
}

/**
 * Where "one line" stops being one line.
 *
 * A stated default, not a measured optimum: two full terminal lines at the 78
 * column the rest of this command wraps to. *Revisit-if* a real decision sheet
 * lands and its own width contradicts this.
 */
const PARAGRAPH_CHARS = 156;

/**
 * Append the run's evidence under the blocker and flip its status.
 *
 * In-file, at the blocker, which is the done-note discipline every phase in
 * this tree already uses — an unblock recorded anywhere else is an unblock the
 * next reader of the roadmap cannot see.
 */
function appendEvidence(file: string, id: string, command: string, output: string, when: string): boolean {
    const text = fs.readFileSync(file, 'utf-8');
    // The id is regex-escaped: ids are parsed with `(.+?)`, so a metacharacter
    // is legal in the tree and an unescaped interpolation threw an uncaught
    // SyntaxError — after the authored command had already run.
    const head = new RegExp(`^###[ \\t]+blocker:[ \\t]*${escapeRe(id)}[ \\t]*$`, 'im');
    const m = head.exec(text);
    if (!m) {
        return false;
    }
    const bodyStart = m.index + m[0].length;
    // The body ends at the next blocker OR the next `##` section. Bounding it
    // only at the next `### blocker:` made the LAST blocker's body run to the
    // end of the file — the common shape, since `## Blockers` is followed by
    // `## Risk Register` — so the evidence bullet landed after the risk table
    // instead of under the blocker, which is the opposite of what this
    // function's whole point is.
    const rest = text.slice(bodyStart);
    const nextHead = /^###[ \t]+blocker:/im.exec(rest);
    const nextSection = /^##[ \t]+\S/m.exec(rest);
    const ends = [nextHead?.index, nextSection?.index].filter((i): i is number => i !== undefined);
    const bodyEnd = ends.length ? bodyStart + Math.min(...ends) : text.length;
    const body = text.slice(bodyStart, bodyEnd);

    const statusRe = /^-[ \t]*\*\*Status:\*\*[ \t]*.*$/im;
    if (!statusRe.test(body)) {
        return false;
    }
    const firstLine = output.split(/\r?\n/).find((l) => l.trim() !== '') ?? '(no output)';
    const flipped = body.replace(
        statusRe,
        `- **Status:** resolved ${when} — class-0 auto-run`,
    );
    const evidence =
        `- **Unblock evidence (${when}):** ran \`${command}\` — exit 0. ` +
        `First line of output: ${firstLine.trim()}\n`;
    const withEvidence = flipped.replace(/\s*$/, '\n') + evidence;
    fs.writeFileSync(file, text.slice(0, bodyStart) + withEvidence + text.slice(bodyEnd), 'utf-8');
    return true;
}

/** `YYYY-MM-DD` for the evidence note. Injected so tests are deterministic. */
function today(now: Date): string {
    return now.toISOString().slice(0, 10);
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ExecuteOptions {
    /**
     * Actually run the class-0 command.
     *
     * Default false, and that default is the control. `Run:` is an arbitrary
     * shell string read out of a markdown file; without this flag the command
     * is ECHOED and refused, so the operator sees exactly what would run before
     * anything runs. `non-destructive-by-default` requires the confirmation to
     * be this-turn and to name the exact object, and the echoed command is that
     * object.
     */
    confirm?: boolean;
}

function execute(
    roadmapRoot: string,
    id: string,
    now: Date,
    opts: ExecuteOptions = {},
): ExecuteResult {
    const found = locate(roadmapRoot, id);
    if (!found) {
        return {
            outcome: 'not-found',
            report: `No open blocker with id '${id}'. Run \`agent-config gates --all\` for the list.\n`,
            code: 1,
        };
    }
    const { blocker, file, rel } = found;
    const cls = blocker_class(blocker);
    const repoRoot = path.dirname(path.dirname(roadmapRoot));

    if (cls === '3') {
        // Byte-identical to today by construction: nothing is executed and
        // nothing is written. The gate is rendered by the caller.
        return {
            outcome: 'rendered',
            report: `${id} is class 3 — human-only. Nothing to execute; see \`agent-config gates\`.\n`,
            code: 0,
        };
    }
    if (cls === '2') {
        return { outcome: 'rendered', report: consentLine(blocker), code: 0 };
    }
    // Class 1 runs under the standing budget decided by `b-gate-budget-preauth`
    // option (a): a per-run cap AND a rolling-7-day cap, with an append-only
    // receipt as the audit surface. Every refusal path RENDERS rather than
    // running — the blocker's own prescription for a missing ledger,
    // generalised to every way the budget can say no. The `--confirm`
    // requirement below is untouched: the caps bound the size of an authorised
    // spend, they never supply the authorisation.
    let budgeted: { estimateUsd: number } | null = null;
    if (cls === '1') {
        const verdict = evaluateGateBudget({
            caps: readGateBudgetCaps(load_agent_settings({ cwd: repoRoot })),
            records: readGateBudgetLedger(repoRoot),
            estimateUsd: parseBudgetUsd(blocker.budget),
            now,
        });
        if (!verdict.ok) {
            return {
                outcome: 'rendered',
                report: consentLine(
                    blocker,
                    `class 1 and ${verdict.detail}, so it renders instead of running`,
                ),
                code: 0,
            };
        }
        budgeted = { estimateUsd: verdict.estimateUsd };
    }

    const command = commandOf(blocker);
    if (command === '') {
        // Unreachable through a linted tree — `lint_roadmap_blockers` fails a
        // class-0 entry with no `Run:` — but reachable through an unlinted one,
        // and guessing a command here is the one thing that must not happen.
        return {
            outcome: 'failed',
            report: `${id} is class ${cls} but carries no **Run:** command. Nothing was executed.\n`,
            code: 1,
        };
    }

    const floor = hardFloorReason(command);
    if (floor !== null) {
        // Refused outright, not offered for confirmation. Class 0 is defined
        // as reversible; a push, merge, deploy or delete is not, so this is a
        // misclassified entry and the fix is to re-author the class — making
        // the operator wave it through would move a Hard Floor onto a keypress.
        return {
            outcome: 'failed',
            report:
                `${id} is class ${cls} but its **Run:** command contains \`${floor}\`, which is a ` +
                'Hard-Floor action under non-destructive-by-default. Classes 0 and 1 are ' +
                'both defined as REVERSIBLE, so this entry is misclassified. ' +
                'Nothing was executed; re-author the class.\n',
            code: 1,
        };
    }

    if (opts.confirm !== true) {
        // Echo-before-run. The command is arbitrary shell read out of a
        // markdown field, so the operator sees the exact string before it runs
        // and the confirmation is this-turn rather than implied by the id.
        return {
            outcome: 'rendered',
            report:
                `${id} is class ${cls} and would run, from the repo root:\n\n` +
                `    ${command}\n\n` +
                'Nothing has been executed. Re-run with `--confirm` to execute it and ' +
                'record the evidence at the blocker.\n',
            code: 0,
        };
    }

    const r = spawnSync(command, {
        shell: true,
        encoding: 'utf-8',
        cwd: repoRoot,
        timeout: 120_000,
    });
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    if (r.error !== undefined || r.status !== 0) {
        // `r.error` is read, not just the status: a spawn failure or a
        // maxBuffer overflow leaves status null with empty output, and
        // "exited null" with no diagnostic is illegible on the one path in
        // this command that writes.
        const why =
            r.error !== undefined
                ? `could not run (${r.error.message})`
                : `exited ${r.status ?? 'null'}`;
        return {
            outcome: 'failed',
            report:
                `${id}: \`${command}\` ${why}. The gate is unchanged — ` +
                'a blocker resolved by a failed command is worse than an open one.\n' +
                output.split(/\r?\n/).slice(0, 10).join('\n') +
                '\n',
            code: 1,
        };
    }
    if (budgeted !== null) {
        // Written BEFORE the file rewrite: an unreceipted spend is invisible to
        // the rolling cap, and the cap failing open is the one way this
        // mechanism could become a blank cheque. `actual_usd` is null because
        // nothing on this path observes the provider's billed amount — the
        // estimate is what the cap compared against and what it records.
        appendGateBudgetReceipt(repoRoot, {
            kind: 'consumption',
            blocker: id,
            authorization: 'confirm-flag',
            estimated_usd: budgeted.estimateUsd,
            actual_usd: null,
            at: now.toISOString(),
            single_use: true,
        });
    }
    const when = today(now);
    if (!appendEvidence(file, id, command, output, when)) {
        return {
            outcome: 'failed',
            report:
                `${id}: \`${command}\` succeeded, but its entry in ${rel} could not be ` +
                'rewritten (no Status field found). Nothing was changed.\n',
            code: 1,
        };
    }
    return {
        outcome: 'resolved',
        report:
            `${id} resolved. Ran \`${command}\` (exit 0); evidence appended in ${rel} ` +
            `and the status flipped to resolved ${when}.\n` +
            (budgeted === null
                ? ''
                : `Receipt appended to ${LEDGER_REL} ` +
                  `($${budgeted.estimateUsd.toFixed(2)} estimated).\n`) +
            // The dashboard is derived from the file this just rewrote, so it
            // is now stale. Saying so is the same follow-up `renderResumed`
            // already prints for its own file-move suggestion.
            'Run `agent-config roadmap:progress` — the dashboard is derived from the ' +
            'file this rewrote and is now stale.\n',
        code: 0,
    };
}

export { execute, consentLine, commandOf, locate, appendEvidence, LEDGER_REL };
export type { ExecuteResult, Outcome };
