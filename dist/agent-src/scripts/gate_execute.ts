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
 *   - **No invented ledger.** Class 1 needs a standing budget, and the shape of
 *     that budget is an OPEN maintainer decision (`b-gate-budget-preauth`).
 *     Until it is taken there is no ledger, so class 1 takes the
 *     render-instead-of-run path — which is the behaviour the blocker itself
 *     prescribes for a missing ledger, not a stub of the decision.
 *   - **No class-3 change.** Byte-identical to the render path, by construction:
 *     it calls the same renderer.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

import { collect, blocker_class, type Blocker } from './update_roadmap_progress.js';

/**
 * Where a class-1 receipt ledger would live once the budget decision is taken.
 *
 * Named here so the absent-ledger branch has something concrete to report, and
 * deliberately NOT created: the path is a consequence of the decision, and
 * writing it now would answer a question that is still the maintainer's.
 */
const LEDGER_REL = path.join('agents', 'runtime', 'state', 'gate-budget-ledger.jsonl');

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
                return { blocker: b, file: path.join(roadmapRoot, path.basename(r.rel)), rel: r.rel };
            }
        }
    }
    return null;
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
    const lines = [`CONSENT · ${head}`, `  Question:       ${b.question.trim() || b.blocks.trim()}`];
    lines.push(
        `  Recommendation: ${rec || '(none recorded — ask for one before deciding)'}`,
    );
    lines.push(`  Default if you say nothing: no change; the gate stays open.`);
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
    const head = new RegExp(`^###[ \\t]+blocker:[ \\t]*${id}[ \\t]*$`, 'im');
    const m = head.exec(text);
    if (!m) {
        return false;
    }
    const bodyStart = m.index + m[0].length;
    const nextHead = /^###[ \t]+blocker:/im.exec(text.slice(bodyStart));
    const bodyEnd = nextHead ? bodyStart + nextHead.index : text.length;
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

function execute(roadmapRoot: string, id: string, now: Date): ExecuteResult {
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
    if (cls === '1') {
        const ledger = path.join(path.dirname(path.dirname(roadmapRoot)), LEDGER_REL);
        if (!fs.existsSync(ledger)) {
            // The blocker's own prescription for a missing ledger: render the
            // consent line INSTEAD of running. Not a degraded mode — the
            // budget shape is an open decision and this is what open means.
            return {
                outcome: 'rendered',
                report: consentLine(
                    blocker,
                    'class 1 with no budget ledger, so it renders instead of running',
                ),
                code: 0,
            };
        }
        return {
            outcome: 'rendered',
            report:
                `${id} is class 1 and a ledger exists at ${LEDGER_REL}, but spend execution ` +
                'is gated on `b-gate-budget-preauth`, which is open. Rendering instead of running.\n',
            code: 0,
        };
    }

    const command = commandOf(blocker);
    if (command === '') {
        // Unreachable through a linted tree — `lint_roadmap_blockers` fails a
        // class-0 entry with no `Run:` — but reachable through an unlinted one,
        // and guessing a command here is the one thing that must not happen.
        return {
            outcome: 'failed',
            report: `${id} is class 0 but carries no **Run:** command. Nothing was executed.\n`,
            code: 1,
        };
    }

    const r = spawnSync(command, {
        shell: true,
        encoding: 'utf-8',
        cwd: path.dirname(path.dirname(roadmapRoot)),
        timeout: 120_000,
    });
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    if (r.status !== 0) {
        return {
            outcome: 'failed',
            report:
                `${id}: \`${command}\` exited ${r.status ?? 'null'}. The gate is unchanged — ` +
                'a blocker resolved by a failed command is worse than an open one.\n' +
                output.split(/\r?\n/).slice(0, 10).join('\n') +
                '\n',
            code: 1,
        };
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
            `and the status flipped to resolved ${when}.\n`,
        code: 0,
    };
}

export { execute, consentLine, commandOf, locate, appendEvidence, LEDGER_REL };
export type { ExecuteResult, Outcome };
