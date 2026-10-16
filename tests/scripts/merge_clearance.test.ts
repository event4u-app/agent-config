import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    clearanceFileName,
    CLEARANCE_DIR,
    deriveOutcome,
    parseClearance,
    readNeedsCouncilLine,
    readSeatReply,
    renderClearance,
    sha256,
    type Seat,
} from '../../src/scripts/_lib/merge_clearance_record.js';
import { checkClearance, writeClearance } from '../../src/scripts/merge_clearance.js';

/**
 * A clearance lets a `needs-council` PR merge, so every way it could be forged
 * or stale must exit non-zero: a verdict typed by the run, a record for an
 * earlier head, and a record whose stated outcome disagrees with its seats.
 */

const HEAD = 'a'.repeat(40);
const OLD_HEAD = 'b'.repeat(40);
const BASE = 'c'.repeat(40);
const CLEAR = 'Reasoning.\n\nDANGEROUS: no\nOWNER REVIEW NEEDED: no\n';
const DANGER = 'A predicate applies.\n\n**DANGEROUS:** yes\n**OWNER REVIEW NEEDED:** yes\n';

let root: string;
const lines: string[] = [];
const out = (l: string): void => {
    lines.push(l);
};

function setup(): void {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-clearance-'));
    fs.mkdirSync(path.join(root, 'src/config'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/config/ratification-policy.json'), JSON.stringify({ required_providers: 2 }));
    lines.length = 0;
}

function writeInputs(replies: { provider: string; text: string; error?: string | null }[], artefact = 'prompt.md'): string[] {
    fs.writeFileSync(path.join(root, 'prompt.md'), 'neutral prompt\n');
    fs.writeFileSync(path.join(root, 'class.txt'), 'trigger ci-workflow — …\nverdict: needs-council (2 trigger(s): ci-workflow, security-surface)\n');
    fs.writeFileSync(
        path.join(root, 'session.json'),
        JSON.stringify({
            artefact: path.join(root, artefact),
            responses: replies.map((r) => ({ provider: r.provider, model: 'm-1', text: r.text, error: r.error ?? null })),
        }),
    );
    return [
        '--pr', '7', '--head', HEAD, '--base', BASE,
        '--classification', path.join(root, 'class.txt'),
        '--session', path.join(root, 'session.json'),
        '--prompt', path.join(root, 'prompt.md'),
    ];
}

const check = (live: string | null, pinned: string | null = null): number =>
    checkClearance({ pr: 7, liveHead: live, pinnedHead: pinned, root }, out);

beforeEach(setup);
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('seat readings', () => {
    it('reads the two answer lines, bold or plain', () => {
        expect(readSeatReply(CLEAR)).toBe('clear');
        expect(readSeatReply(DANGER)).toBe('dangerous');
        expect(readSeatReply('DANGEROUS: no\nOWNER REVIEW NEEDED: yes')).toBe('owner-review');
    });

    it('gives no final verdict for a missing, contradictory, errored or empty reply', () => {
        expect(readSeatReply('looks fine to me, CLEAR')).toBe('no-final-verdict');
        expect(readSeatReply('DANGEROUS: no\nDANGEROUS: yes\nOWNER REVIEW NEEDED: no')).toBe('no-final-verdict');
        expect(readSeatReply(CLEAR, 'os_error: ENOBUFS')).toBe('no-final-verdict');
        expect(readSeatReply('')).toBe('no-final-verdict');
    });

    it('derives the outcome from the seats', () => {
        const s = (provider: string, reading: Seat['reading']) => ({ provider, reading });
        expect(deriveOutcome([s('anthropic', 'clear'), s('openai', 'clear')], 2)).toBe('cleared');
        expect(deriveOutcome([s('anthropic', 'clear'), s('anthropic', 'clear')], 2)).toBe('not-cleared');
        expect(deriveOutcome([s('anthropic', 'clear'), s('openai', 'owner-review')], 2)).toBe('not-cleared');
        expect(deriveOutcome([s('anthropic', 'clear'), s('openai', 'dangerous')], 2)).toBe('dangerous');
        expect(deriveOutcome([s('anthropic', 'clear'), s('openai', 'no-final-verdict')], 2)).toBe('not-cleared');
    });

    it('reads the triggers of a needs-council line only', () => {
        expect(readNeedsCouncilLine('verdict: needs-council (2 trigger(s): ci-workflow, security-surface)')).toEqual([
            'ci-workflow',
            'security-surface',
        ]);
        expect(readNeedsCouncilLine('verdict: needs-council (dependency-manifest: the head changes a dependency manifest)')).toEqual([
            'dependency-manifest',
        ]);
        expect(readNeedsCouncilLine('verdict: needs-owner (1 trigger(s): governance-surface)')).toBeNull();
        expect(readNeedsCouncilLine('verdict: routine')).toBeNull();
    });
});

describe('write, then check', () => {
    it('writes a cleared record from two clearing seats, and the check passes for the live head', () => {
        const code = writeClearance(writeInputs([{ provider: 'anthropic', text: CLEAR }, { provider: 'openai', text: CLEAR }]), root, out);
        expect(code).toBe(0);
        const rel = path.join(root, CLEARANCE_DIR, clearanceFileName(7, HEAD));
        const text = fs.readFileSync(rel, 'utf8');
        expect(text).toContain('outcome: cleared');
        expect(text).toContain('assurance: recorded');
        expect(text).toContain(`prompt_sha256: ${sha256('neutral prompt\n')}`);
        expect(text).not.toContain('Reasoning.');
        expect(check(HEAD)).toBe(0);
    });

    it('a dangerous seat is recorded and never clears', () => {
        writeClearance(writeInputs([{ provider: 'anthropic', text: CLEAR }, { provider: 'openai', text: DANGER }]), root, out);
        expect(fs.readFileSync(path.join(root, CLEARANCE_DIR, clearanceFileName(7, HEAD)), 'utf8')).toContain('outcome: dangerous');
        expect(check(HEAD)).toBe(1);
    });

    it('takes the last reply per provider as its final one', () => {
        writeClearance(
            writeInputs([
                { provider: 'anthropic', text: DANGER },
                { provider: 'openai', text: CLEAR },
                { provider: 'anthropic', text: CLEAR },
            ]),
            root,
            out,
        );
        expect(check(HEAD)).toBe(0);
    });

    it('refuses a session whose artefact is not the prompt given', () => {
        expect(writeClearance(writeInputs([{ provider: 'anthropic', text: CLEAR }], 'other.md'), root, out)).toBe(2);
    });

    it('refuses a needs-owner classification — it is never sent for clearance', () => {
        const argv = writeInputs([{ provider: 'anthropic', text: CLEAR }, { provider: 'openai', text: CLEAR }]);
        fs.writeFileSync(path.join(root, 'class.txt'), 'verdict: needs-owner (1 trigger(s): governance-surface)\n');
        expect(writeClearance(argv, root, out)).toBe(2);
    });
});

describe('attack fixtures — each exits non-zero', () => {
    it('a typed CLEAR string with no session record', () => {
        const argv = writeInputs([]);
        fs.writeFileSync(path.join(root, 'session.json'), 'CLEAR');
        expect(writeClearance(argv, root, out)).toBe(2);
        fs.mkdirSync(path.join(root, CLEARANCE_DIR), { recursive: true });
        fs.writeFileSync(path.join(root, CLEARANCE_DIR, clearanceFileName(7, HEAD)), 'CLEAR\n');
        expect(check(HEAD)).toBe(1);
    });

    it('a record for an earlier head', () => {
        const argv = writeInputs([{ provider: 'anthropic', text: CLEAR }, { provider: 'openai', text: CLEAR }]);
        argv[argv.indexOf('--head') + 1] = OLD_HEAD;
        expect(writeClearance(argv, root, out)).toBe(0);
        expect(check(HEAD)).toBe(1);
        expect(check(OLD_HEAD, HEAD)).toBe(1);
    });

    it('a record copied to the live head’s name still names the earlier head', () => {
        const argv = writeInputs([{ provider: 'anthropic', text: CLEAR }, { provider: 'openai', text: CLEAR }]);
        argv[argv.indexOf('--head') + 1] = OLD_HEAD;
        writeClearance(argv, root, out);
        const dir = path.join(root, CLEARANCE_DIR);
        fs.copyFileSync(path.join(dir, clearanceFileName(7, OLD_HEAD)), path.join(dir, clearanceFileName(7, HEAD)));
        expect(check(HEAD)).toBe(1);
    });

    it('a record whose recorded outcome disagrees with its seats', () => {
        writeClearance(writeInputs([{ provider: 'anthropic', text: CLEAR }, { provider: 'openai', text: DANGER }]), root, out);
        const file = path.join(root, CLEARANCE_DIR, clearanceFileName(7, HEAD));
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('outcome: dangerous', 'outcome: cleared'));
        expect(check(HEAD)).toBe(1);
        expect(lines.join('\n')).toContain('disagrees with its seats');
    });

    it('an unreadable live head never clears', () => {
        expect(check(null)).toBe(1);
    });
});

describe('the record round-trips', () => {
    it('parses what it renders', () => {
        const c = {
            pr: 3,
            head: HEAD,
            base: BASE,
            classifierVerdict: 'needs-council' as const,
            triggers: ['ci-workflow'],
            promptSha256: 'd'.repeat(64),
            seats: [
                { provider: 'anthropic', model: 'claude-x', replySha256: 'e'.repeat(64), reading: 'clear' as const },
                { provider: 'openai', model: 'codex-default', replySha256: 'f'.repeat(64), reading: 'clear' as const },
            ],
            outcome: 'cleared' as const,
        };
        expect(parseClearance(renderClearance(c), 2)).toEqual(c);
        expect(Array.isArray(parseClearance(renderClearance(c), 3))).toBe(true);
    });
});
