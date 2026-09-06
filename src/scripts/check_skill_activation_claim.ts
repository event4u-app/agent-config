#!/usr/bin/env tsx
/**
 * The published skill-activation figure agrees with the record it came from.
 *
 * WHY THIS IS A SEPARATE SCRIPT FROM THE CENSUS
 * ---------------------------------------------
 * `report_skill_activation` is a REPORT: it gates on nothing, has no threshold,
 * and its own docstring says it must never acquire one. This is a GATE, and the
 * two must not share an entry point — `src/config/gate-coverage.yml` is a
 * manifest of gates, and `_lib/gate_population.ts` classifies a script by its
 * prefix precisely so that "is this a gate" is answered structurally rather
 * than by whoever last edited a config. Registering a `report_*` id there forks
 * that population, which `tests/scripts/gate_population.test.ts` refuses.
 *
 * So the split is not cosmetic. The report keeps its exit-0 contract; the
 * assertion that CAN fail lives here, where a floor and a self-test belong.
 *
 * WHAT IT CANNOT DO, STATED SO NOBODY READS IT AS COVERED
 * ------------------------------------------------------
 * It compares two COMMITTED files — the census record against the sentence
 * `docs/CLAIMS.md` publishes. It cannot tell whether the record still describes
 * the world: the transcript store it was taken from is one machine's, keyed on
 * the directory the census ran in, and absent from CI. Re-taking the
 * measurement is `report_skill_activation --emit`, which refuses to write from
 * an empty store. This gate only forbids the published sentence and the record
 * from telling two different stories.
 *
 * Exit: 0 agree · 1 disagree or a file is missing.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';
import {
  CLAIMS_PATH,
  CLAIM_ID,
  RECORD_PATH,
  claimBlock,
  claimProblems,
  parseClaimFigures,
  readRecord,
} from './report_skill_activation.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export function check(root: string): number {
  const rec = readRecord(root);
  if (rec === null) {
    process.stderr.write(`❌  ${RECORD_PATH} is missing — the published figure has no record behind it.\n`);
    return 1;
  }
  const claimsFile = path.join(root, CLAIMS_PATH);
  if (!fs.existsSync(claimsFile)) {
    process.stderr.write(`❌  ${CLAIMS_PATH} is missing.\n`);
    return 1;
  }
  const block = claimBlock(fs.readFileSync(claimsFile, 'utf8'), CLAIM_ID);
  // Emitted before the verdict on both paths: a gate that reports what it
  // inspected only when it passes leaves the coverage census blind exactly when
  // it matters.
  reportScanned({
    gate: 'check_skill_activation_claim',
    scanned: block === null ? 0 : 1,
    units: 'published claim block(s)',
    roots: [CLAIMS_PATH],
  });
  if (block === null) {
    process.stderr.write(`❌  claim \`${CLAIM_ID}\` is not in ${CLAIMS_PATH}.\n`);
    return 1;
  }
  const problems = claimProblems(rec, parseClaimFigures(block));
  if (problems.length > 0) {
    process.stderr.write('❌  the published census claim and its record disagree:\n');
    for (const p of problems) {
      process.stderr.write(`  · ${p}\n`);
    }
    process.stderr.write(
      `\nRe-take the measurement (report_skill_activation --emit) and update the claim from ${RECORD_PATH}.\n`,
    );
    return 1;
  }
  process.stdout.write(`✅  census claim matches ${RECORD_PATH} (measured ${rec.measured_at}).\n`);
  return 0;
}

/**
 * The gate proving it still discriminates.
 *
 * The third case is the one a value comparison alone would miss: a claim that
 * silently stops stating a figure would otherwise pass every equality test it
 * no longer participates in.
 */
function selfTest(): number {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-claim-selftest-'));
  const record = {
    schema_version: 1,
    measured_at: '2026-01-02',
    skills_shipped: 300,
    with_trigger_key: 10,
    with_trigger_corpus: 100,
    trigger_key_and_corpus: 5,
    human_named_only: 195,
    sessions: 7,
    assistant_turns: 1234,
    invocations: 0,
    distinct_skills_invoked: 0,
    stores: ['fixture'],
  };
  const agreeing =
    '`report_skill_activation` over 7 sessions and 1,234 assistant turns records 0 Skill ' +
    'invocations and 0 of 300 distinct skills (measured 2026-01-02). 10 declare a ' +
    'machine-matchable trigger key in frontmatter, 100 carry an `evals/triggers.json` corpus, ' +
    '5 do both, and the remaining 195 are reachable only by a human naming them.';
  const write = (name: string, body: string): string => {
    const root = path.join(tmp, name);
    fs.mkdirSync(path.join(root, path.dirname(RECORD_PATH)), { recursive: true });
    fs.mkdirSync(path.join(root, path.dirname(CLAIMS_PATH)), { recursive: true });
    fs.writeFileSync(path.join(root, RECORD_PATH), JSON.stringify(record));
    fs.writeFileSync(
      path.join(root, CLAIMS_PATH),
      `# Claims\n\n### claim: ${CLAIM_ID}\n- claim: ${body}\n- kind: quant\n- status: backed\n- last_verified: 2026-01-02\n\n### claim: unrelated\n- claim: x\n`,
    );
    return root;
  };
  const run = (root: string): number =>
    runGateCli(REPO_ROOT, 'src/scripts/check_skill_activation_claim.ts', ['--root', root], root);
  try {
    return runSelfTest({
      gate: 'check_skill_activation_claim',
      minCases: 4,
      minRejectCases: 3,
      cases: [
        {
          name: 'a turn count that moved away from the record is rejected',
          expect: 'reject',
          run: () => run(write('turns', agreeing.replace('1,234 assistant', '9,999 assistant'))),
        },
        {
          name: 'a population redrawn to enlarge the human-named remainder is rejected',
          expect: 'reject',
          run: () => run(write('population', agreeing.replace('remaining 195 are', 'remaining 290 are'))),
        },
        {
          name: 'a claim that stops stating the population split is rejected',
          expect: 'reject',
          run: () => run(write('dropped', agreeing.slice(0, agreeing.indexOf('. 10 declare') + 1))),
        },
        {
          name: 'a claim reproducing every recorded figure passes',
          expect: 'accept',
          run: () => run(write('agreeing', agreeing)),
        },
      ],
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function main(argv: readonly string[]): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write('usage: check_skill_activation_claim [--root DIR] [--self-test]\n');
    return 0;
  }
  if (argv.includes('--self-test')) {
    return selfTest();
  }
  const i = argv.indexOf('--root');
  return check(i === -1 ? REPO_ROOT : (argv[i + 1] ?? REPO_ROOT));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
