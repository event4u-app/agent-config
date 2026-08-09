#!/usr/bin/env node
/**
 * Detector corpus gate (P4.3 of road-to-rule-delivery-integrity).
 *
 * Every self-repair detector must carry all THREE fixture classes, and every
 * fixture must behave as its class says:
 *
 *   fire            a recorded real failure the detector must catch
 *   near-miss-fire  a real failure phrased unlike the canonical one, which must
 *                   still be caught — recall at the boundary
 *   must-not-fire   text that superficially matches and must stay silent
 *
 * The three-class rule is the point of the gate rather than a stylistic one.
 * Precision and recall fail in opposite directions and a single corpus hides
 * that: a detector with `fire` cases only looks perfect while opening records on
 * praise, which is exactly what `detectUserReport` did until 2026-08-09 (it
 * fired on "das ist fine, du hast nichts falsch gemacht"). A missing class is
 * therefore a gate failure, not a warning — the absent half is where the defects
 * live.
 *
 * Registration is explicit: a detector added to `self_repair.ts` without a
 * matching corpus entry fails here, which is the coupling that keeps the corpus
 * from silently lagging the code.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import {
    type DefectFinding,
    type TurnSnapshot,
    detectCouncilClaim,
    detectLanguageMirror,
    detectUserReport,
} from './_lib/self_repair.js';
import { assertScanned } from './_lib/scan_scope.js';

export const CORPUS_REL = path.join('tests', 'fixtures', 'self-repair-detector-corpus.yml');

const GATE = 'check_detector_corpus';
const CLASSES = ['fire', 'near-miss-fire', 'must-not-fire'] as const;
type FixtureClass = (typeof CLASSES)[number];

/** One corpus entry, in the union of shapes the three detectors need. */
export interface Fixture {
    text?: string;
    reply?: string;
    pinned_language?: 'de' | 'en';
    tool_commands?: string[];
    note?: string;
}

export type Corpus = Record<string, Partial<Record<FixtureClass, Fixture[]>>>;

/**
 * Every detector that must appear in the corpus, with how to run it.
 *
 * Keyed by the `defect_class` the detector produces, so the corpus reads as a
 * list of defect classes rather than of function names.
 */
export const DETECTORS: Record<string, (f: Fixture) => DefectFinding | null> = {
    'user-reported': (f) => detectUserReport(f.text ?? f.reply ?? ''),
    'council-availability-claim': (f) => detectCouncilClaim(asTurn(f)),
    'language-mirror': (f) => detectLanguageMirror(asTurn(f)),
};

function asTurn(f: Fixture): TurnSnapshot {
    return {
        prompt: f.text ?? '',
        reply: f.reply ?? '',
        toolCommands: f.tool_commands ?? [],
        pinnedLanguage: f.pinned_language ?? null,
    };
}

export interface Finding {
    detector: string;
    kind: 'missing-class' | 'empty-class' | 'wrong-outcome' | 'unregistered';
    message: string;
}

/** Pure: audit a parsed corpus against the registered detectors. */
export function auditCorpus(corpus: Corpus): { findings: Finding[]; fixtures: number } {
    const findings: Finding[] = [];
    let fixtures = 0;

    for (const name of Object.keys(corpus)) {
        if (!(name in DETECTORS)) {
            findings.push({
                detector: name,
                kind: 'unregistered',
                message: `corpus names "${name}", which is not a registered detector`,
            });
        }
    }

    for (const [name, run] of Object.entries(DETECTORS)) {
        const entry = corpus[name];
        if (entry === undefined) {
            findings.push({
                detector: name,
                kind: 'missing-class',
                message: `no corpus entry at all — needs all of: ${CLASSES.join(', ')}`,
            });
            continue;
        }
        for (const cls of CLASSES) {
            const cases = entry[cls];
            if (cases === undefined) {
                findings.push({
                    detector: name,
                    kind: 'missing-class',
                    message: `missing the \`${cls}\` class`,
                });
                continue;
            }
            if (cases.length === 0) {
                // An empty class is the same hole as a missing one wearing a key.
                findings.push({
                    detector: name,
                    kind: 'empty-class',
                    message: `\`${cls}\` is present but empty`,
                });
                continue;
            }
            for (const f of cases) {
                fixtures += 1;
                const fired = run(f) !== null;
                const shouldFire = cls !== 'must-not-fire';
                if (fired !== shouldFire) {
                    const what = f.text ?? f.reply ?? '(empty)';
                    findings.push({
                        detector: name,
                        kind: 'wrong-outcome',
                        message:
                            `\`${cls}\` fixture ${shouldFire ? 'did NOT fire' : 'FIRED'}: ` +
                            JSON.stringify(what.slice(0, 90)),
                    });
                }
            }
        }
    }
    return { findings, fixtures };
}

export function loadCorpus(repoRoot: string): Corpus {
    const p = path.join(repoRoot, CORPUS_REL);
    const parsed = YAML.parse(fs.readFileSync(p, 'utf-8')) as { detectors?: Corpus };
    return parsed.detectors ?? {};
}

export function main(repoRoot: string = process.cwd()): number {
    const corpus = loadCorpus(repoRoot);
    const { findings, fixtures } = auditCorpus(corpus);

    // A corpus that parsed to nothing is the dead-scope case, not a pass.
    assertScanned({
        gate: GATE,
        scanned: fixtures,
        units: 'detector fixtures',
        roots: [CORPUS_REL],
    });

    if (findings.length > 0) {
        process.stderr.write(`${GATE}: ${String(findings.length)} finding(s)\n\n`);
        for (const f of findings) {
            process.stderr.write(`  ${f.detector}: ${f.message}\n`);
        }
        process.stderr.write(
            `\nEvery detector needs all three classes (${CLASSES.join(', ')}) and every\n` +
                'fixture must behave as its class says. Precision and recall fail in\n' +
                'opposite directions; a corpus missing one half hides the other.\n',
        );
        return 1;
    }

    process.stdout.write(
        `✅  ${GATE}: ${String(Object.keys(DETECTORS).length)} detector(s) × ` +
            `${String(CLASSES.length)} classes, ${String(fixtures)} fixtures, all behaving\n`,
    );
    return 0;
}

function isCliEntry(): boolean {
    const argv1 = process.argv[1];
    if (argv1 === undefined) {
        return false;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(argv1))
        );
    } catch {
        return pathToFileURL(argv1).href === import.meta.url;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
