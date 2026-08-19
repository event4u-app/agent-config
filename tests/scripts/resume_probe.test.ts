// Tests for src/agent-src/scripts/resume_probe.ts — the class-0 liveness
// check behind `road-to-gate-autonomy` step 4.1.
//
// Every case runs against a fixture roadmap tree in a tmpdir, never the live
// estate: a probe whose only test is the real tree stops testing anything the
// day the real tree changes, and `request-scoped-rule-load` will eventually be
// resumed. The live case is reproduced here as a fixture so the regression
// survives its own fix.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    conditionClause,
    extractCondition,
    probeLater,
    referencedPath,
    referencedRoadmaps,
    roadmapDisposition,
    stepIsDone,
} from '../../src/agent-src/scripts/resume_probe.js';

let root = '';

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-probe-'));
    fs.mkdirSync(path.join(root, 'later'), { recursive: true });
    fs.mkdirSync(path.join(root, 'archive'), { recursive: true });
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('resume_probe — the fired case', () => {
    it('detects the regression fixture: the named roadmap has archived', () => {
        // The shape measured live on 2026-08-17: a park note waiting on a step
        // of a roadmap that has since closed and moved to archive/.
        write(
            'later/road-to-request-scoped-rule-load.md',
            [
                '---',
                'status: later',
                '---',
                '',
                '# Road to request-scoped rule load',
                '',
                '> **Parked in `later/`.**',
                '> **Resume when P2.1 of `road-to-rule-delivery-integrity` closes** — the',
                '> catalogue-logging falsifier.',
                '',
                'Body prose that mentions `road-to-something-else` and must not count.',
                '',
            ].join('\n'),
        );
        write('archive/road-to-rule-delivery-integrity.md', '# closed\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('fired');
        expect(f!.refs).toEqual(['road-to-rule-delivery-integrity']);
        expect(f!.why).toContain('archived');
    });

    it('fires when a still-active roadmap has ticked the named step', () => {
        write(
            'later/road-to-parked.md',
            ['> **Resume when 2.1 of `road-to-live` closes.**', ''].join('\n'),
        );
        write('road-to-live.md', '- [x] **2.1** the thing\n- [ ] **2.2** the other thing\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('fired');
        expect(f!.why).toContain('ticked');
    });
});

describe('resume_probe — the unmet case is NOT listed as fired', () => {
    it('a named roadmap still active with the step open stays unmet', () => {
        write('later/road-to-parked.md', '> **Resume when 2.1 of `road-to-live` closes.**\n');
        write('road-to-live.md', '- [ ] **2.1** the thing\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('unmet');
        expect(f!.why).toContain('still open');
    });

    it('a multi-roadmap condition needs EVERY named roadmap closed', () => {
        // Comma-separated on purpose: an "and"/"both" phrasing is caught one
        // step earlier by the compound guard, so this is the shape that
        // actually reaches the per-ref loop.
        write(
            'later/road-to-parked.md',
            '> **Resume when `road-to-a`, `road-to-b` close.**\n',
        );
        write('archive/road-to-a.md', '# closed\n');
        write('road-to-b.md', '- [ ] still going\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('unmet');
    });

    it('a lowercase conjunction is compound too — the guard is case-insensitive', () => {
        // Regression for R2 finding 6: COMPOUND_RE shipped without `i` while
        // every sibling regex had it, so this exact note would have fired on
        // its single resolvable conjunct.
        write(
            'later/road-to-parked.md',
            '> **Resume when `road-to-a` closes and telemetry shows demand.**\n',
        );
        write('archive/road-to-a.md', '# closed\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('undecidable');
        expect(f!.why).toContain('compound');
    });

    it('an "and" in the EXPLANATION is not a conjunction of conditions', () => {
        // Measured while fixing finding 6: making COMPOUND_RE case-insensitive
        // is right, and on its own it produced the opposite false result —
        // ordinary prose after the em dash read as a second conjunct and the
        // one genuinely fired note in the tree dropped out. The clause is the
        // bolded span; the paragraph after it is commentary.
        write(
            'later/road-to-parked.md',
            [
                '> **Resume when P2.1 of `road-to-a` closes** — the falsifier that measures',
                '> whether a description reaches the model at all, and the report itself',
                '> declines to produce a rate.',
                '',
            ].join('\n'),
        );
        write('archive/road-to-a.md', '# closed\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('fired');
    });

    it('a roadmap named only in the explanation is not a dependency', () => {
        write(
            'later/road-to-parked.md',
            [
                '> **Resume when `road-to-a` closes** — context: this was spun out of',
                '> `road-to-b`, which is unrelated to the condition.',
                '',
            ].join('\n'),
        );
        write('archive/road-to-a.md', '# closed\n');
        write('road-to-b.md', '- [ ] still going\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('fired');
        expect(f!.refs).toEqual(['road-to-a']);
    });

    it('a resume marker in body prose is not the condition', () => {
        // Regression for R2 finding 14: the marker search covered the whole
        // file, so ordinary prose could become "the condition".
        write(
            'later/road-to-parked.md',
            [
                '> **Parked.** No machine-readable condition here.',
                '',
                'Historical note: this was blocked until `road-to-a` closed, back in June.',
                '',
            ].join('\n'),
        );
        write('archive/road-to-a.md', '# closed\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('undecidable');
        expect(f!.condition).toBe('');
    });

    it('a fenced example of the syntax is documentation, not a condition', () => {
        write(
            'later/road-to-parked.md',
            ['> **Parked.**', '', '```markdown', '> **Resume when `road-to-a` closes.**', '```', ''].join(
                '\n',
            ),
        );
        write('archive/road-to-a.md', '# closed\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('undecidable');
    });

    it('the step id must sit in the label position, not anywhere on the line', () => {
        // Regression for R2 finding 5: an earlier unrelated line mentioning
        // the number decided the verdict, and exec returns the first match.
        write('later/road-to-parked.md', '> **Resume when 2.1 of `road-to-live` closes.**\n');
        write(
            'road-to-live.md',
            ['- [x] **1.4** raise the cap from 2.0 to 2.1', '- [ ] **2.1** the real step', ''].join(
                '\n',
            ),
        );

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('unmet');
    });
});

describe('resume_probe — undecidable is its own answer, never silence', () => {
    it('a condition naming no roadmap is undecidable, not unmet', () => {
        write(
            'later/road-to-parked.md',
            '> **Resume when a second non-video domain lands.**\n',
        );
        const [f] = probeLater(root);
        expect(f!.verdict).toBe('undecidable');
        expect(f!.refs).toEqual([]);
    });

    it('a slug that resolves nowhere is undecidable, never fired', () => {
        // A typo in a park note must not resume a roadmap. "Not found" and
        // "archived" are different facts and only one of them is a closure.
        write('later/road-to-parked.md', '> **Resume when `road-to-typo` closes.**\n');
        const [f] = probeLater(root);
        expect(f!.verdict).toBe('undecidable');
        expect(f!.why).toContain('resolves nowhere');
    });

    it('a park note with no resume line at all is reported, not skipped', () => {
        write('later/road-to-parked.md', '# no marker anywhere\n');
        const [f] = probeLater(root);
        expect(f!.verdict).toBe('undecidable');
        expect(f!.condition).toBe('');
    });
});

describe('resume_probe — the two false positives the first live run produced', () => {
    // Both were real notes, both reported FIRED, both wrong. They are fixtures
    // rather than references to the live files because the whole point of the
    // probe is that those files eventually move.

    it('a roadmap cited under **Origin:** is provenance, not a dependency', () => {
        // Shape of later/road-to-per-workspace-license-policy.md: the real
        // condition is about a consumer repo; the archived roadmap underneath
        // is only where the note came from.
        write(
            'later/road-to-parked.md',
            [
                '> **Blocked until:** a real consumer repo hits the v1 escalation.',
                '> **Origin:** `road-to-provenance-and-license-governance.md` Q1-residual.',
                '',
            ].join('\n'),
        );
        write('archive/road-to-provenance-and-license-governance.md', '# closed\n');

        const [f] = probeLater(root);
        expect(f!.verdict).not.toBe('fired');
        expect(f!.refs).toEqual([]);
    });

    it('a Trigger: line naming where a roadmap came from is not a condition', () => {
        // Shape of later/road-to-cross-model-routing-eval.md. `trigger` is a
        // provenance idiom in this tree, so the probe does not accept it as a
        // dependency marker even though the disposition lint does.
        write(
            'later/road-to-parked.md',
            '> **Trigger:** Spun out of `road-to-governance-moat` (Iron Law 3 resolution).\n',
        );
        write('archive/road-to-governance-moat.md', '# closed\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('undecidable');
        expect(f!.condition).toBe('');
    });

    it('a conjunction of tracks does not fire on the one track it can read', () => {
        // Shape of later/road-to-contract-integrity.md: two named tracks
        // joined by `+`, only one of them a resolvable roadmap slug.
        write(
            'later/road-to-parked.md',
            '> **Blocked until** the pruning track (`road-to-tier-removal` + command-surface-leanness) lands.\n',
        );
        write('archive/road-to-tier-removal.md', '# closed\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('undecidable');
        expect(f!.why).toContain('compound');
    });

    it('an enumerated multi-part condition stays undecidable', () => {
        // Shape of later/road-to-deferred-rule-retriever.md: archived roadmaps
        // AND demand signals no filesystem check can see.
        write(
            'later/road-to-parked.md',
            '> **Blocked until BOTH hold:** (1) `road-to-a` closes, and (2) telemetry shows demand.\n',
        );
        write('archive/road-to-a.md', '# closed\n');

        const [f] = probeLater(root);
        expect(f!.verdict).toBe('undecidable');
    });
});

describe('resume_probe — the parsing pieces', () => {
    it('a wrapped blockquote condition is read whole, not truncated', () => {
        const text = ['> **Resume when P2.1 of `road-to-x`', '> actually closes.**', '', '> Later context.'].join(
            '\n',
        );
        expect(extractCondition(text)).toContain('actually closes');
        expect(extractCondition(text)).not.toContain('Later context');
    });

    it('a roadmap never counts as its own dependency', () => {
        expect(referencedRoadmaps('resume when `road-to-self` closes', 'road-to-self')).toEqual([]);
    });

    it('roadmapDisposition separates archived from missing', () => {
        write('archive/road-to-gone.md', 'x');
        expect(roadmapDisposition(root, 'road-to-gone')).toBe('archive');
        expect(roadmapDisposition(root, 'road-to-never')).toBe('missing');
    });

    it('stepIsDone distinguishes absent from open', () => {
        expect(stepIsDone('- [x] **1.1** done\n', '1.1')).toBe(true);
        expect(stepIsDone('- [ ] **1.1** open\n', '1.1')).toBe(false);
        expect(stepIsDone('- [ ] **1.1** open\n', '9.9')).toBeNull();
    });

    it('README.md in later/ is not a park note', () => {
        write('later/README.md', '# how later/ works\n');
        expect(probeLater(root)).toEqual([]);
    });
});

// The second decidable condition form, added by `road-to-estate-drawdown`
// Phase 2 batch 1. Until it existed the probe could decide exactly ONE
// phrasing — a roadmap slug — so 42 of 44 live park notes were `undecidable`,
// and the batch's own PARK-PROBEABLE verdict would have promised a probe that
// could not read the conditions it was writing.
describe('resume_probe — a repo path as the condition', () => {
    let repoRoot = '';

    function park(body: string): void {
        write('later/road-to-parked.md', ['---', 'status: later', '---', '', '# Parked', '', body, ''].join('\n'));
    }

    beforeEach(() => {
        repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-probe-repo-'));
    });

    afterEach(() => {
        fs.rmSync(repoRoot, { recursive: true, force: true });
    });

    it('fires when the named file exists', () => {
        park('> **Blocked until:** `docs/contracts/thing.md` exists.');
        fs.mkdirSync(path.join(repoRoot, 'docs', 'contracts'), { recursive: true });
        fs.writeFileSync(path.join(repoRoot, 'docs', 'contracts', 'thing.md'), 'x', 'utf-8');
        const [f] = probeLater(root, repoRoot);
        expect(f!.verdict).toBe('fired');
        expect(f!.why).toContain('exists');
    });

    it('reports unmet — not undecidable — when the named file is absent', () => {
        park('> **Blocked until:** `agents/evidence/analysis/never-written.md` exists.');
        const [f] = probeLater(root, repoRoot);
        expect(f!.verdict).toBe('unmet');
        expect(f!.why).toContain('does not exist');
    });

    // The over-fire this guard exists to stop, reproduced from the live case:
    // `skill-catalogue.jsonl` exists with 7 lines while the bar is 20, so a
    // bare existence test would have un-parked a roadmap 13 observations early.
    it('stays undecidable when the predicate is a content bar, not existence', () => {
        park('> **Blocked until:** `agents/evidence/metrics/skill-catalogue.jsonl` holds at least 20 observations.');
        fs.mkdirSync(path.join(repoRoot, 'agents', 'evidence', 'metrics'), { recursive: true });
        fs.writeFileSync(path.join(repoRoot, 'agents', 'evidence', 'metrics', 'skill-catalogue.jsonl'), '{}\n', 'utf-8');
        const [f] = probeLater(root, repoRoot);
        expect(f!.verdict).toBe('undecidable');
    });

    it('stays undecidable for a bare directory, which exists in every checkout', () => {
        park('> **Blocked until:** a signal exists under `agents/evidence/`.');
        fs.mkdirSync(path.join(repoRoot, 'agents', 'evidence'), { recursive: true });
        const [f] = probeLater(root, repoRoot);
        expect(f!.verdict).toBe('undecidable');
    });

    it('refuses two paths — a conjunction it could only half-weigh', () => {
        expect(referencedPath('`docs/a.md` exists and `docs/b.md` exists')).toBeNull();
    });

    it('refuses a path when the predicate is not existence', () => {
        expect(referencedPath('`docs/a.md` holds at least 20 rows')).toBeNull();
    });

    // The truncation this fix repairs: a naive stop-at-any-dot cut the clause
    // at the `.` inside `.md`, hiding the very path the condition named.
    it('a dot inside a backticked path does not end the clause', () => {
        const c = conditionClause('**Blocked until:** `docs/contracts/thing.md` exists. Commentary follows.');
        expect(c).toContain('thing.md`');
        expect(c).not.toContain('Commentary');
    });
});

// R2 round 1 findings 4, 5, 6 — each row is the shape the reviewer named, and
// each fails when its guard is reverted.
describe('resume_probe — R2 round 1: the path branch, hardened', () => {
    let repoRoot = '';

    function park(body: string): void {
        write('later/road-to-parked.md', ['---', 'status: later', '---', '', '# Parked', '', body, ''].join('\n'));
    }

    beforeEach(() => {
        repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-probe-repo2-'));
    });

    afterEach(() => {
        fs.rmSync(repoRoot, { recursive: true, force: true });
    });

    // Finding 4 — word-presence is not a predicate. A negated "exists" used to
    // take the path branch and report FIRED while the file was still there.
    it('refuses a NEGATED existence claim over the path', () => {
        expect(referencedPath('`docs/legacy.md` no longer exists')).toBeNull();
    });

    // Finding 4, the other half — the existence word paired with a path it does
    // not govern.
    it('refuses an existence word detached from the path', () => {
        expect(referencedPath('blocked until a workaround exists, see `docs/x.md`')).toBeNull();
    });

    it('still accepts the predicate bound to its own path', () => {
        expect(referencedPath('`docs/x.md` exists')).toBe('docs/x.md');
        expect(referencedPath('`docs/x.md` currently exists')).toBe('docs/x.md');
    });

    // Finding 5 — a clause naming a roadmap AND a path is a conjunction; the
    // path used to be dropped silently and the roadmap half decided alone.
    it('refuses a clause naming both a roadmap and a path', () => {
        write('archive/road-to-gone.md', 'x');
        park('> **Blocked until:** `road-to-gone` closes, `docs/contracts/thing.md` exists.');
        const [f] = probeLater(root, repoRoot);
        expect(f!.verdict).toBe('undecidable');
        expect(f!.why).toContain('conjunction');
    });

    // Finding 6 — an unbalanced backtick left `inCode` stuck true, so the whole
    // commentary became the clause and a path mentioned only there could decide.
    it('an unbalanced backtick does not pull commentary into the clause', () => {
        const c = conditionClause('**Blocked until:** the `host ships it. Commentary names `docs/x.md` exists.');
        expect(c).not.toContain('docs/x.md');
    });
});
