#!/usr/bin/env tsx
/**
 * capture_skill_catalogue — make the skill-catalogue delivery defect countable.
 *
 * THE HOST BOUNDARY, STATED FIRST BECAUSE IT DECIDES THE SHAPE OF THIS TOOL.
 * The round-6 census asked for a `session_start` concern that logs the injected
 * catalogue block. A concern cannot do that. The dispatcher envelope carries
 * `session_id`, `source`, `cwd`, `transcript_path` — the injected catalogue is
 * part of the request's system payload, and `preamble_byte_census.ts` already
 * verified independently that no local transcript or file carries it. A hook
 * that "captures the catalogue" would therefore be capturing something else and
 * reporting it under that name, which is worse than not measuring.
 *
 * So the capture is deliberately two-sided, and each side is labelled with what
 * it actually is:
 *
 *   PROJECTION (deterministic) — what the projected skill tree offers the host:
 *   per entry, whether a `description:` exists, how long it is, which
 *   frontmatter keys it carries, and its position in the sorted catalogue. This
 *   is the host's INPUT and it is fully file-measurable.
 *
 *   OBSERVATION — which entries actually arrived, and how many did not. This
 *   side has TWO sources and every record says which one it came from:
 *
 *     `self-report` — an agent reading its own context lists the bare names.
 *     Only the agent can see this. It is not enforcement and nothing here
 *     pretends otherwise. This is the claude-shaped path.
 *
 *     `host-event` — the host publishes its own truncation on a machine
 *     channel. `codex exec --json` emits an `item.completed` error event whose
 *     message states how many entries it dropped, so the count is READ, never
 *     transcribed. This is the codex-shaped path and it is deterministic.
 *
 *   Hosts do not truncate the same way, so a record also carries a
 *   `truncation_mode`: `per-entry` (some entries arrive bare, others full —
 *   claude) versus `budget-strip-and-drop` (every description stripped, then N
 *   entries dropped wholesale — codex). Pooling the two into one verdict would
 *   average two different mechanisms into a number describing neither, so the
 *   report is always per host.
 *
 * The join of the two answers the question the census could not: not "how many
 * are bare" but WHICH PROPERTY separates bare from described. That is the
 * selector, and it is what a delivery fix has to act on. A positional
 * head-N hypothesis is one candidate among several and this tool is built to
 * falsify it rather than assume it — the first observation recorded against
 * this repo showed entries far past position 40 carrying full descriptions
 * while an earlier one was bare, which no head-N budget explains.
 *
 * PRIVACY BY CONSTRUCTION. An observation record carries skill names, integer
 * counts, a host label and two closed enums. The record type has no field able
 * to hold prompt text, file bodies, paths outside the catalogue, or user
 * content — the same shape `domain-safety-pii` § Surface 2 requires of a log
 * event. The codex path reads a host message and keeps only the integer in it;
 * the message text itself never reaches a record. Do not widen it with a
 * free-form field.
 *
 * A ZERO IS NEVER INFERRED FROM SILENCE. If the host's budget event is absent
 * or unparseable — reworded upstream, or removed — the capture fails loudly
 * rather than recording `dropped: 0`, because a broken parser and a fixed
 * defect would otherwise look identical. Recording a genuine no-truncation run
 * takes an explicit `--assert-no-truncation`.
 *
 * Exit codes: 0 report produced · 1 usage/IO error, an empty catalogue root
 * (a catalogue scan that found nothing must never read as a clean result), or
 * an unreadable host observation.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    DEFAULT_CATALOGUE_ROOTS,
    OBSERVATION_LOG,
    analyzeSelector,
    buildHostEventRecord,
    buildObservationRecord,
    formatPerHostVerdicts,
    formatReport,
    knownHostLimits,
    measureCatalogueVolume,
    parseHostBudgetEvent,
    readObservationLog,
    readProjectedCatalogue,
    type SelectorReport,
} from './_lib/skill_catalogue.js';

// Re-exported so the CLI module stays the one public name for this tool.
export * from './_lib/skill_catalogue.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

function resolveCatalogueRoot(explicit: string | null): string {
    if (explicit) {
        if (!fs.existsSync(explicit)) {
            throw new Error(`catalogue root does not exist: ${explicit}`);
        }
        return explicit;
    }
    for (const candidate of DEFAULT_CATALOGUE_ROOTS) {
        const abs = path.join(REPO, candidate);
        if (fs.existsSync(abs)) return abs;
    }
    throw new Error(
        `no catalogue root found — tried ${DEFAULT_CATALOGUE_ROOTS.join(', ')} under ${REPO}`,
    );
}

function argValue(flag: string): string | null {
    const index = process.argv.indexOf(flag);
    if (index === -1 || index + 1 >= process.argv.length) return null;
    return process.argv[index + 1]!;
}

/** `~` expanded against the current user's home. */
function expandHome(p: string): string {
    return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

/**
 * `--limits` — publish the per-host picture: what each host was measured to
 * deliver, and whether the observed hosts truncate the same way.
 */
function runLimitsMode(): number {
    const records = readObservationLog(path.join(REPO, OBSERVATION_LOG));
    const limits = knownHostLimits(records);

    if (process.argv.includes('--json')) {
        process.stdout.write(
            `${JSON.stringify({ hosts: [...limits.values()], observations: records.length }, null, 2)}\n`,
        );
        return 0;
    }

    process.stdout.write(`${formatPerHostVerdicts(records)}\n\n`);
    if (limits.size === 0) {
        process.stdout.write(
            'measured truncations: none.\nOnly a host that publishes its own dropped count yields one; a\nself-reported observation states which entries arrived bare, which is a\nselector question, not a ceiling.\n',
        );
        return 0;
    }
    process.stdout.write('measured truncations:\n');
    for (const limit of [...limits.values()].sort((a, b) => a.host.localeCompare(b.host))) {
        process.stdout.write(
            `  ${limit.host}: dropped ${limit.droppedEntries} entries on ${limit.observedAt}, ` +
                `at a projection of ${limit.projectedVolume}\n`,
        );
    }
    return 0;
}

/** `--volume <host-root>` — the projection half for one host, byte-accurate. */
function runVolumeMode(rootArg: string): number {
    const root = expandHome(rootArg);
    if (!fs.existsSync(root)) {
        process.stderr.write(`❌  host root does not exist: ${root}\n`);
        return 1;
    }
    const volume = measureCatalogueVolume(argValue('--host') ?? path.basename(root).replace(/^\./, ''), root);
    if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(volume, null, 2)}\n`);
        return 0;
    }
    process.stdout.write(
        `host: ${volume.host}\nroot: ${volume.root}\n` +
            `skill entries: ${volume.skillEntries}\ncommand entries: ${volume.commandEntries}\n` +
            `artefacts offered: ${volume.artefacts}\n` +
            `description payload: ${volume.descriptionBytes} bytes\n\n` +
            'This is the PROJECTION half — what the host is offered, not what it delivered.\n',
    );
    return 0;
}

/**
 * `--host-event <file|->` — record what the host itself published.
 *
 * The deterministic path. `-` reads stdin, so the capture composes directly:
 *   codex exec --json --skip-git-repo-check "reply with exactly: OK" \
 *     | capture_skill_catalogue --host-event - --host codex --host-root ~/.codex
 */
function runHostEventMode(source: string): number {
    const stream =
        source === '-'
            ? fs.readFileSync(0, 'utf-8')
            : fs.readFileSync(expandHome(source), 'utf-8');

    const hostRootArg = argValue('--host-root');
    if (!hostRootArg) {
        process.stderr.write(
            '❌  --host-event requires --host-root <dir> — the dropped count is only\n' +
                '    meaningful against the number of artefacts the host was offered.\n',
        );
        return 1;
    }
    const host = argValue('--host') ?? 'unknown';
    const volume = measureCatalogueVolume(host, expandHome(hostRootArg));
    if (volume.artefacts === 0) {
        process.stderr.write(`❌  host root ${volume.root} offers no catalogue artefacts\n`);
        return 1;
    }

    const event = parseHostBudgetEvent(stream);
    if (event === null) {
        if (!process.argv.includes('--assert-no-truncation')) {
            process.stderr.write(
                '❌  no parseable skills-budget event in this stream.\n' +
                    '    That is UNKNOWN, not zero: a reworded or removed host message looks\n' +
                    '    exactly like a fixed defect. If this run genuinely did not truncate,\n' +
                    '    say so with --assert-no-truncation.\n',
            );
            return 1;
        }
        process.stdout.write(
            `host: ${host}\noffered: ${volume.artefacts}\ndropped: 0 (asserted — no budget event in the stream)\n`,
        );
        return 0;
    }

    process.stdout.write(
        `host: ${host}\nroot: ${volume.root}\n` +
            `artefacts offered: ${volume.artefacts} (${volume.skillEntries} skills + ${volume.commandEntries} commands)\n` +
            `description payload: ${volume.descriptionBytes} bytes\n` +
            `dropped by the host: ${event.droppedCount}\n` +
            `descriptions stripped: ${event.descriptionsStripped ? 'yes — all of them' : 'no'}\n\n` +
            'Source: host-event (read from the host\'s own JSON channel, not self-reported).\n' +
            'No delivered count is printed: the offered figure above is THIS tool\'s\n' +
            'projection and the dropped figure is the host\'s, and a controlled probe\n' +
            'showed they do not share a denominator. Subtracting them would invent a number.\n',
    );

    if (process.argv.includes('--record')) {
        const stampedAt = argValue('--observed-at');
        if (!stampedAt) {
            process.stderr.write('❌  --record requires --observed-at <ISO date>\n');
            return 1;
        }
        const logPath = path.join(REPO, OBSERVATION_LOG);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        const record = buildHostEventRecord(host, stampedAt, volume.artefacts, event, volume.skillEntries);
        fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`);
        process.stdout.write(`recorded → ${OBSERVATION_LOG}\n`);
    }
    return 0;
}

function main(): number {
    if (process.argv.includes('--limits')) return runLimitsMode();

    const volumeRoot = argValue('--volume');
    if (volumeRoot) return runVolumeMode(volumeRoot);

    const hostEvent = argValue('--host-event');
    if (hostEvent) return runHostEventMode(hostEvent);

    const root = resolveCatalogueRoot(argValue('--catalogue-root'));
    const projected = readProjectedCatalogue(root);

    if (projected.length === 0) {
        process.stderr.write(
            `❌  catalogue root ${root} holds no SKILL.md entries — a scan that found nothing is not a clean result\n`,
        );
        return 1;
    }

    const observedPath = argValue('--observed');
    if (!observedPath) {
        // Projection-only mode: the deterministic half, for a baseline snapshot.
        const withDescription = projected.filter((e) => e.hasDescription).length;
        const payload = {
            catalogue_root: path.relative(REPO, root) || root,
            entries_total: projected.length,
            declares_description: withDescription,
            declares_none: projected.length - withDescription,
        };
        if (process.argv.includes('--json')) {
            process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        } else {
            process.stdout.write(
                `catalogue root: ${payload.catalogue_root}\nentries: ${payload.entries_total}\ndeclares a description: ${payload.declares_description}\ndeclares none: ${payload.declares_none}\n\nThis is the PROJECTION half only — what the host is offered. Which entries actually\narrived bare is a live-session observation; pass it with --observed <file>.\n`,
            );
        }
        return 0;
    }

    const readNames = (p: string): string[] =>
        fs
            .readFileSync(p, 'utf-8')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('#'));

    const observedBare = readNames(observedPath);

    // A PARTIAL observation must supply both lists. Without `--described` the
    // analyzer treats every non-bare entry as observed-described, which is only
    // true of a whole-catalogue read; on a partial one it would silently invent
    // hundreds of observations nobody made.
    const describedPath = argValue('--described');
    const observedDescribed = describedPath ? readNames(describedPath) : undefined;

    const report: SelectorReport = {
        catalogueRoot: path.relative(REPO, root) || root,
        ...analyzeSelector(projected, observedBare, observedDescribed),
    };

    if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write(`${formatReport(report)}\n`);
    }

    const host = argValue('--host') ?? 'unknown';
    const stampedAt = argValue('--observed-at');
    if (process.argv.includes('--record')) {
        if (!stampedAt) {
            process.stderr.write('❌  --record requires --observed-at <ISO date>\n');
            return 1;
        }
        const logPath = path.join(REPO, OBSERVATION_LOG);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(
            logPath,
            `${JSON.stringify(buildObservationRecord(report, host, stampedAt))}\n`,
        );
        process.stdout.write(`\nrecorded → ${OBSERVATION_LOG}\n`);
    }

    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    try {
        process.exit(main());
    } catch (error) {
        process.stderr.write(`❌  ${(error as Error).message}\n`);
        process.exit(1);
    }
}
