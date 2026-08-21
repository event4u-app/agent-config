// Tests for src/scripts/check_new_adr_evidence.ts — the mechanism behind AC-5's
// first clause (road-to-evidence-based-adr-governance, review finding 4).
//
// Every case here was sabotage-verified: the mechanism it targets was broken in
// the gate, the test was watched go RED, and the mechanism restored. A test
// never seen red has unknown sensitivity, and this gate's normal reading is ZERO
// added records — the one state where a working gate and a broken one print the
// same thing.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GateLedger } from '../../src/scripts/_lib/gate_ledger.js';
import {
    ADR_PATHSPECS,
    addedAdrRecords,
    checkRecords,
    hasEvidenceSection,
    main,
} from '../../src/scripts/check_new_adr_evidence.js';

const FULL = [
    'adr: 901',
    'status: accepted',
    'date: 2026-08-21',
    'decision: probe',
    'provenance:',
    '  kind: mixed',
    'evidence:',
    '  strength: E3',
].join('\n');

function record(frontmatter: string, body: string): string {
    return `---\n${frontmatter}\n---\n\n# ADR-901 — probe\n\n${body}\n`;
}

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cnae-test-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function write(rel: string, contents: string): void {
    const abs = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents, 'utf8');
}

describe('hasEvidenceSection — the heading, never a mention of the word', () => {
    it('finds an `## Evidence` heading', () => {
        expect(hasEvidenceSection('# X\n\n## Evidence\n\nMeasured.\n')).toBe(true);
    });

    it('finds the heading at any level', () => {
        expect(hasEvidenceSection('#### Evidence\n')).toBe(true);
        expect(hasEvidenceSection('# Evidence\n')).toBe(true);
    });

    it('accepts a compound heading that starts with Evidence', () => {
        expect(hasEvidenceSection('## Evidence and assumptions\n')).toBe(true);
    });

    it('a mention of the word in prose is NOT a section', () => {
        // The distinction the finding asked for: prose about evidence is not a
        // disclosure of it.
        expect(hasEvidenceSection('# X\n\nThe evidence here is thin. Evidence matters.\n')).toBe(false);
    });

    it('a heading whose text merely contains the word is not enough', () => {
        expect(hasEvidenceSection('## Supporting evidence\n')).toBe(false);
    });

    it('a heading quoted inside a fenced block does not count', () => {
        // An ADR that shows the reader what the section looks like has not
        // written one.
        expect(hasEvidenceSection('# X\n\n```\n## Evidence\n```\n')).toBe(false);
        expect(hasEvidenceSection('# X\n\n~~~\n## Evidence\n~~~\n')).toBe(false);
    });

    it('a real section AFTER a fenced example still counts', () => {
        expect(hasEvidenceSection('```\n## Evidence\n```\n\n## Evidence\n\nReal.\n')).toBe(true);
    });
});

describe('checkRecords — what an added ACCEPTED record must disclose', () => {
    it('a record with both axes and a section is clean', () => {
        write('docs/decisions/ADR-901-probe.md', record(FULL, '## Evidence\n\nMeasured.'));
        const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
        expect(r.findings).toEqual([]);
        expect(r.checked).toEqual(['docs/decisions/ADR-901-probe.md']);
    });

    it('a missing `## Evidence` section is a violation — the AC-5 gap itself', () => {
        write('docs/decisions/ADR-901-probe.md', record(FULL, '## Context\n\nNothing.'));
        const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
        expect(r.findings).toHaveLength(1);
        expect(r.findings[0]?.reason).toMatch(/`## Evidence` section/);
    });

    it('a missing `evidence.strength` is a violation', () => {
        const fm = FULL.split('\n').filter((l) => !/^(evidence:|\s+strength:)/.test(l)).join('\n');
        write('docs/decisions/ADR-901-probe.md', record(fm, '## Evidence\n\nMeasured.'));
        const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
        expect(r.findings).toHaveLength(1);
        expect(r.findings[0]?.reason).toMatch(/evidence\.strength/);
    });

    it('a missing `provenance.kind` is a violation', () => {
        const fm = FULL.split('\n').filter((l) => !/^(provenance:|\s+kind:)/.test(l)).join('\n');
        write('docs/decisions/ADR-901-probe.md', record(fm, '## Evidence\n\nMeasured.'));
        const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
        expect(r.findings).toHaveLength(1);
        expect(r.findings[0]?.reason).toMatch(/provenance\.kind/);
    });

    it('a `provenance:` map present but carrying no `kind:` is still a violation', () => {
        // Presence of the KEY is not disclosure; the axis has to say something.
        const fm = FULL.replace('  kind: mixed', '  decision_makers: [owner]');
        write('docs/decisions/ADR-901-probe.md', record(fm, '## Evidence\n\nMeasured.'));
        const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
        expect(r.findings[0]?.reason).toMatch(/provenance\.kind/);
    });

    it('all three missing are reported in ONE finding naming all three', () => {
        write('docs/decisions/ADR-901-probe.md', record('adr: 901\nstatus: accepted\n', '## Context\n\nNo.'));
        const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
        expect(r.findings).toHaveLength(1);
        const reason = r.findings[0]?.reason ?? '';
        expect(reason).toMatch(/provenance\.kind/);
        expect(reason).toMatch(/evidence\.strength/);
        expect(reason).toMatch(/`## Evidence` section/);
    });

    it('`authority_basis: owner_intent` does NOT excuse the section', () => {
        // That field governs where AUTHORITY comes from, never whether the
        // record discloses what it rests on. Reading it as a disclosure
        // exemption would turn the one honest escape into the hole.
        write(
            'docs/decisions/ADR-901-probe.md',
            record(`${FULL}\nauthority_basis: owner_intent`, '## Context\n\nOwner says so.'),
        );
        const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
        expect(r.findings).toHaveLength(1);
        expect(r.findings[0]?.reason).toMatch(/`## Evidence` section/);
    });
});

describe('checkRecords — scope', () => {
    it('a non-accepted record is OUT OF SCOPE and reported as such, not skipped silently', () => {
        write(
            'docs/decisions/ADR-901-probe.md',
            record('adr: 901\nstatus: proposed\n', '## Context\n\nStill argued.'),
        );
        const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
        expect(r.findings).toEqual([]);
        expect(r.outOfScope).toEqual([{ file: 'docs/decisions/ADR-901-probe.md', status: 'proposed' }]);
    });

    it('every non-accepted status is out of scope, not just `proposed`', () => {
        for (const status of ['superseded', 'rejected', 'deprecated']) {
            write('docs/decisions/ADR-901-probe.md', record(`adr: 901\nstatus: ${status}\n`, '## X'));
            const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
            expect(r.findings, status).toEqual([]);
            expect(r.outOfScope[0]?.status).toBe(status);
        }
    });

    it('an unset status is out of scope but named `(unset)` rather than blank', () => {
        write('docs/decisions/ADR-901-probe.md', record('adr: 901\n', '## X'));
        expect(checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']).outOfScope[0]?.status).toBe('(unset)');
    });

    it('an added record with NO frontmatter fails rather than passing unread', () => {
        // Its status is unreadable, so "is it accepted" has no answer. Failing is
        // the honest direction — the alternative lets an unreadable record
        // through the one gate that exists to read it.
        write('docs/decisions/ADR-901-probe.md', '# ADR-901\n\nNo frontmatter at all.\n');
        const r = checkRecords(tmp, ['docs/decisions/ADR-901-probe.md']);
        expect(r.findings).toHaveLength(1);
        expect(r.findings[0]?.reason).toMatch(/no YAML frontmatter/);
    });

    it('a listed-but-absent file is out of scope, never a finding', () => {
        const r = checkRecords(tmp, ['docs/decisions/ADR-902-gone.md']);
        expect(r.findings).toEqual([]);
        expect(r.checked).toEqual([]);
    });

    it('an empty file list yields no findings', () => {
        expect(checkRecords(tmp, []).findings).toEqual([]);
    });
});

describe('checkRecords — ledger accounting', () => {
    it('every planned record reaches exactly one terminal outcome', () => {
        write('docs/decisions/ADR-901-ok.md', record(FULL, '## Evidence\n\nMeasured.'));
        write('docs/decisions/ADR-902-bad.md', record(FULL, '## Context\n\nNo.'));
        write('docs/decisions/ADR-903-prop.md', record('status: proposed\n', '## X'));
        const ledger = new GateLedger('check_new_adr_evidence');
        checkRecords(
            tmp,
            ['docs/decisions/ADR-901-ok.md', 'docs/decisions/ADR-902-bad.md', 'docs/decisions/ADR-903-prop.md'],
            ledger,
        );
        // `finalize` throws when a planned target reached no outcome — the silent
        // `continue` this ledger exists to catch.
        const tally = ledger.finalize();
        expect(tally.planned).toBe(3);
        expect(tally.completed).toBe(1);
        expect(tally.failed).toBe(1);
        expect(tally.out_of_scope).toBe(1);
        expect(tally.unaccounted).toBe(0);
    });
});

// ── the diff seam ──────────────────────────────────────────────────────────
// The whole point of the gate is the two-ref diff: a single-file linter has no
// notion of NEW, which is why AC-5's first clause had no mechanism. These run
// real git.

function git(root: string, args: readonly string[]): string {
    const env = { ...process.env };
    delete env['GIT_DIR'];
    delete env['GIT_WORK_TREE'];
    delete env['GIT_INDEX_FILE'];
    return execFileSync(
        'git',
        [
            '-c',
            'user.email=t@example.invalid',
            '-c',
            'user.name=t',
            '-c',
            'commit.gpgsign=false',
            '-c',
            'core.hooksPath=',
            ...args,
        ],
        { cwd: root, encoding: 'utf8', env, stdio: 'pipe' },
    );
}

/** A repo with a committed base; returns the base sha. */
function initRepo(): string {
    git(tmp, ['init', '-q']);
    write('README.md', '# base\n');
    git(tmp, ['add', '-A']);
    git(tmp, ['commit', '-q', '-m', 'base']);
    return git(tmp, ['rev-parse', 'HEAD']).trim();
}

describe('addedAdrRecords — ADDED, on both surfaces, and nothing else', () => {
    it('lists a flat record added since the base', () => {
        const base = initRepo();
        write('docs/decisions/ADR-901-probe.md', record(FULL, '## Evidence\n\nX.'));
        git(tmp, ['add', '-A']);
        git(tmp, ['commit', '-q', '-m', 'add']);
        expect(addedAdrRecords(tmp, base)).toEqual(['docs/decisions/ADR-901-probe.md']);
    });

    it('lists a per-area record added since the base', () => {
        const base = initRepo();
        write('docs/adrs/telegraph/0009-probe.md', record(FULL, '## Evidence\n\nX.'));
        git(tmp, ['add', '-A']);
        git(tmp, ['commit', '-q', '-m', 'add']);
        expect(addedAdrRecords(tmp, base)).toEqual(['docs/adrs/telegraph/0009-probe.md']);
    });

    it('a MODIFIED pre-existing record is not "added" — the corpus is out of scope', () => {
        // The scope decision this gate rests on: 147 accepted records predate the
        // axes, and retrofitting them is a migration event, not a gate.
        write('docs/decisions/ADR-901-probe.md', record(FULL, '## Context\n\nNo evidence section.'));
        git(tmp, ['init', '-q']);
        git(tmp, ['add', '-A']);
        git(tmp, ['commit', '-q', '-m', 'base']);
        const base = git(tmp, ['rev-parse', 'HEAD']).trim();
        write('docs/decisions/ADR-901-probe.md', record(FULL, '## Context\n\nStill none, edited.'));
        git(tmp, ['add', '-A']);
        git(tmp, ['commit', '-q', '-m', 'edit']);
        expect(addedAdrRecords(tmp, base)).toEqual([]);
    });

    it('a non-ADR markdown file in the same directory is not in scope', () => {
        const base = initRepo();
        write('docs/decisions/adr-evidence-sweep-2026-08.md', '# sweep\n');
        write('docs/decisions/README.md', '# index\n');
        git(tmp, ['add', '-A']);
        git(tmp, ['commit', '-q', '-m', 'add']);
        expect(addedAdrRecords(tmp, base)).toEqual([]);
    });

    it('a file under docs/adrs/ that is not NNNN-named is not in scope', () => {
        const base = initRepo();
        write('docs/adrs/telegraph/README.md', '# area\n');
        write('docs/adrs/telegraph/notes.md', '# notes\n');
        git(tmp, ['add', '-A']);
        git(tmp, ['commit', '-q', '-m', 'add']);
        expect(addedAdrRecords(tmp, base)).toEqual([]);
    });

    it('a DEEPER path under docs/adrs/ is rejected — git pathspec wildcards match `/`', () => {
        // The one case the pathspecs alone do NOT cover, and the reason the
        // anchored regexes exist beside them: git's default pathspec magic lets
        // `*` cross a `/`, so `docs/adrs/*​/NNNN-*.md` also matches
        // `docs/adrs/a/b/0001-x.md`. Without the regex filter that file becomes a
        // finding on somebody else's surface. Removing the filter must red HERE
        // — the two negative cases above stay green on the pathspecs alone, so
        // they prove nothing about this layer.
        const base = initRepo();
        write('docs/adrs/area/nested/0001-probe.md', record(FULL, '## Evidence\n\nX.'));
        git(tmp, ['add', '-A']);
        git(tmp, ['commit', '-q', '-m', 'add']);
        expect(addedAdrRecords(tmp, base)).toEqual([]);
    });

    it('the two declared pathspecs are the two decision surfaces', () => {
        expect(ADR_PATHSPECS).toEqual([
            'docs/decisions/ADR-*.md',
            'docs/adrs/*/[0-9][0-9][0-9][0-9]-*.md',
        ]);
    });
});

describe('main — exit codes, and the zero-added case', () => {
    const inRepo = <T>(fn: () => T): T => {
        const cwd = process.cwd();
        process.chdir(tmp);
        try {
            return fn();
        } finally {
            process.chdir(cwd);
        }
    };

    it('a branch that adds no record exits 0 — the normal case must stay green', () => {
        // The load-bearing behaviour: `assertScanned` throws on a zero count
        // unless a justified `allowEmpty` reason is given, so without one this
        // gate would red on every branch that adds no ADR.
        const base = initRepo();
        expect(inRepo(() => main(['--base', base]))).toBe(0);
    });

    it('an added accepted record that discloses exits 0', () => {
        const base = initRepo();
        write('docs/decisions/ADR-901-probe.md', record(FULL, '## Evidence\n\nMeasured.'));
        git(tmp, ['add', '-A']);
        git(tmp, ['commit', '-q', '-m', 'add']);
        expect(inRepo(() => main(['--base', base]))).toBe(0);
    });

    it('an added accepted record with no disclosure exits 1', () => {
        const base = initRepo();
        write('docs/decisions/ADR-901-probe.md', record(FULL, '## Context\n\nNothing.'));
        git(tmp, ['add', '-A']);
        git(tmp, ['commit', '-q', '-m', 'add']);
        expect(inRepo(() => main(['--base', base]))).toBe(1);
    });

    it('an unresolvable base is exit 2, never a green pass over an assumed-empty diff', () => {
        // The dangerous direction: an unresolvable base makes every record look
        // un-added, and the gate would pass by scanning nothing.
        initRepo();
        expect(inRepo(() => main(['--base', 'refs/heads/does-not-exist']))).toBe(2);
    });
});
