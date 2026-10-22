import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    COMMIT_LOG_FORMAT,
    CONSUMER_IMPACT_VALUES,
    parse_commit_log,
    parse_impact_trailers,
    release_impact_entry,
    with_release_impact,
} from '../../src/scripts/_lib/consumer_impact';
import type { Commit} from '../../src/scripts/release';
import { commit_from_record, set_package_version } from '../../src/scripts/release';

describe('parse_impact_trailers', () => {
    it.each(CONSUMER_IMPACT_VALUES)('reads Consumer-Impact: %s as recorded', (value) => {
        const t = parse_impact_trailers(`Body text.\n\nConsumer-Impact: ${value}\n`);
        expect(t).toEqual({ impact: value, recorded: true, invalid: null, security: false });
    });

    it('defaults an untrailered body to none and records the absence', () => {
        expect(parse_impact_trailers('just a body\n')).toEqual({
            impact: 'none',
            recorded: false,
            invalid: null,
            security: false,
        });
    });

    it('keeps an out-of-enum value as invalid and does not count it as recorded', () => {
        const t = parse_impact_trailers('Consumer-Impact: huge\n');
        expect(t.recorded).toBe(false);
        expect(t.invalid).toContain('huge');
        expect(t.impact).toBe('none');
    });

    it('reads Security: yes and ignores any other Security value', () => {
        expect(parse_impact_trailers('Consumer-Impact: notice\nSecurity: yes\n').security).toBe(true);
        expect(parse_impact_trailers('Security: no\n').security).toBe(false);
    });

    it('does not read a trailer word that only appears mid-line', () => {
        expect(parse_impact_trailers('see the Consumer-Impact: action note\n').recorded).toBe(false);
    });

    it('ignores a Consumer-Impact line quoted in prose outside the trailer block', () => {
        const quoted = 'Write it like this:\nConsumer-Impact: action\n\nThis commit changes nothing.\n';
        expect(parse_impact_trailers(quoted)).toEqual({ impact: 'none', recorded: false, invalid: null, security: false });
        const mixed = 'Intro.\n\nConsumer-Impact: action\nis the line a breaking commit needs.\n';
        expect(parse_impact_trailers(mixed).recorded).toBe(false);
    });

    it('reads the trailer from the final block beside other trailers and continuations', () => {
        const body = 'Prose.\n\nConsumer-Impact: notice\nSigned-off-by: a <a@example.com>\n  continued\nCo-Authored-By: b <b@example.com>\n';
        expect(parse_impact_trailers(body)).toEqual({ impact: 'notice', recorded: true, invalid: null, security: false });
    });

    it('refuses conflicting duplicate trailers and accepts an agreeing duplicate', () => {
        const conflict = parse_impact_trailers('Consumer-Impact: none\nConsumer-Impact: action\n');
        expect(conflict.recorded).toBe(false);
        expect(conflict.invalid).toContain('conflicting');
        expect(parse_impact_trailers('Consumer-Impact: action\nConsumer-Impact: action\n').impact).toBe('action');
    });

    it('accepts only the canonical key and value spelling', () => {
        expect(parse_impact_trailers('consumer-impact: action\n').invalid).toContain('Consumer-Impact');
        expect(parse_impact_trailers('Consumer-Impact: Action\n').recorded).toBe(false);
        expect(parse_impact_trailers('Consumer-Impact: action\n').recorded).toBe(true);
    });

    it('reads Security: yes only from the trailer block', () => {
        expect(parse_impact_trailers('Security: yes\nwas suggested.\n\nDone.\n').security).toBe(false);
    });
});

describe('parse_impact_trailers — GitHub squash-merge bodies', () => {
    const coauthor = 'Co-authored-by: Claude <noreply@anthropic.com>\n';

    it('reads a trailer block that GitHub buried above its Co-authored-by paragraph', () => {
        const body =
            '* feat(x): one\n\nProse about the change.\n\nConsumer-Impact: notice\nCo-Authored-By: a <a@example.com>\n\n' +
            '* docs(x): two\n\n---------\n\n' +
            coauthor;
        expect(parse_impact_trailers(body)).toEqual({ impact: 'notice', recorded: true, invalid: null, security: false });
    });

    it('takes the most severe value across the squashed commits, as a release span does', () => {
        const body =
            '* fix(a): one\n\nConsumer-Impact: automatic\n\n* fix(b): two\n\nConsumer-Impact: notice\nSecurity: yes\n\n' +
            '* fix(c): three\n\nConsumer-Impact: automatic\n\n' +
            coauthor;
        expect(parse_impact_trailers(body)).toEqual({ impact: 'notice', recorded: true, invalid: null, security: true });
    });

    it('still refuses two different values inside one trailer block', () => {
        const body = '* fix(a): one\n\nConsumer-Impact: none\nConsumer-Impact: action\n\n' + coauthor;
        const t = parse_impact_trailers(body);
        expect(t.recorded).toBe(false);
        expect(t.invalid).toContain('conflicting');
    });

    it('refuses the squash when any block carries an invalid key or value', () => {
        expect(parse_impact_trailers('Consumer-Impact: huge\n\nConsumer-Impact: notice\n\n' + coauthor).invalid).toContain('huge');
        expect(parse_impact_trailers('consumer-impact: notice\n\n' + coauthor).invalid).toContain('Consumer-Impact');
    });

    it('does not count a Consumer-Impact line inside prose, a quote or a code fence', () => {
        const prose = 'The squashed PR said Consumer-Impact: action in passing.\n\n' + coauthor;
        const quoted = 'Reviewer wrote:\n> Consumer-Impact: action\nso we kept it.\n\n' + coauthor;
        const fenced = 'Example:\n```\nConsumer-Impact: action\n```\n\n' + coauthor;
        const indented = 'Example:\n\n    Consumer-Impact: action\n\n' + coauthor;
        const spacedFence = '```\n\nConsumer-Impact: action\n\n```\n\n' + coauthor;
        for (const body of [prose, quoted, fenced, indented, spacedFence]) {
            expect(parse_impact_trailers(body)).toEqual({ impact: 'none', recorded: false, invalid: null, security: false });
        }
    });
});

describe('breaking detection — independent of the conventional subject parse', () => {
    const sha = 'e'.repeat(40);
    const breaking: Array<[string, string]> = [
        ['feat!: drop the flag', ''],
        ['feat(api)!: drop the flag', ''],
        ['BREAKING CHANGE: remove legacy command', ''],
        ['Remove legacy command BREAKING-CHANGE', ''],
        ['feat: drop the flag BREAKING CHANGE', ''],
        ['feat: drop the flag', 'Why.\n\nBREAKING CHANGE: the flag is gone'],
        ['feat: drop the flag', 'Why.\n\nBREAKING-CHANGE: the flag is gone'],
        ['Remove legacy command', 'BREAKING CHANGE: it is gone\n\nMore detail on a later paragraph.'],
    ];

    it.each(breaking)('%j with body %j is breaking, and without a trailer it records none', (subject, body) => {
        const c = commit_from_record({ sha, subject, body });
        expect(c.breaking).toBe(true);
        expect(c.trailers).toMatchObject({ impact: 'none', recorded: false });
    });

    it.each(breaking)('%j with body %j records the trailer that closes the body', (subject, body) => {
        const c = commit_from_record({ sha, subject, body: `${body}\n\nConsumer-Impact: action\n` });
        expect(c.trailers).toMatchObject({ impact: 'action', recorded: true });
    });

    it('does not flag lowercase prose or a non-conventional plain subject', () => {
        expect(commit_from_record({ sha, subject: 'feat: x', body: 'not a breaking change: just prose' }).breaking).toBe(false);
        expect(commit_from_record({ sha, subject: 'Merge stuff', body: '' }).breaking).toBe(false);
    });

    it('keeps conflicting trailers on a breaking commit as invalid, not recorded', () => {
        const c = commit_from_record({ sha, subject: 'feat!: x', body: 'Consumer-Impact: none\nConsumer-Impact: action' });
        expect(c.trailers.recorded).toBe(false);
        expect(c.trailers.invalid).toContain('conflicting');
    });
});

describe('parse_commit_log', () => {
    it('splits records whose bodies contain newlines', () => {
        const raw =
            `${'a'.repeat(40)}\x1ffeat!: one\x1fline 1\nConsumer-Impact: action\n\x1e\n` +
            `${'b'.repeat(40)}\x1ffix: two\x1f\x1e\n`;
        const recs = parse_commit_log(raw);
        expect(recs.map((r) => r.subject)).toEqual(['feat!: one', 'fix: two']);
        expect(recs[0]!.body).toContain('Consumer-Impact: action');
        expect(recs[1]!.body).toBe('');
    });
});

describe('commit_from_record — the release pass reads the trailer', () => {
    const sha = 'c'.repeat(40);

    it('returns the four values and none for an untrailered subject', () => {
        const got = [
            ...CONSUMER_IMPACT_VALUES.map((v) =>
                commit_from_record({ sha, subject: 'feat: x', body: `Consumer-Impact: ${v}\n` }),
            ),
            commit_from_record({ sha, subject: 'feat: y', body: '' }),
        ].map((c) => [c.trailers.impact, c.trailers.recorded]);
        expect(got).toEqual([
            ['none', true],
            ['automatic', true],
            ['notice', true],
            ['action', true],
            ['none', false],
        ]);
    });

    it('keeps the breaking flag exactly as the subject rule decides it', () => {
        expect(commit_from_record({ sha, subject: 'feat(api)!: drop', body: '' }).breaking).toBe(true);
        expect(commit_from_record({ sha, subject: 'feat: add', body: '' }).breaking).toBe(false);
        expect(commit_from_record({ sha, subject: 'not conventional', body: '' }).type).toBe('other');
    });
});


let tmp: string | null = null;
afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = null;
});

function fixture_span(breaking_body: string): Commit[] {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-impact-span-'));
    const g = (...a: string[]): string =>
        execFileSync('git', ['-C', tmp!, ...a], {
            encoding: 'utf-8',
            env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
        });
    g('init', '-q');
    g('config', 'user.email', 'fixture@example.com');
    g('config', 'user.name', 'fixture');
    g('commit', '-q', '--allow-empty', '-m', 'chore: base');
    g('tag', '1.0.0');
    g('commit', '-q', '--allow-empty', '-m', 'fix: plain change');
    g('commit', '-q', '--allow-empty', '-m', 'feat(ci)!: rework the pipeline', '-m', breaking_body);
    const raw = g('log', '1.0.0..HEAD', '--no-merges', `--format=${COMMIT_LOG_FORMAT}`);
    return parse_commit_log(raw).map(commit_from_record);
}

describe('a release span read from a real git log', () => {
    it('keeps a breaking commit without a trailer in the span, recorded as none', () => {
        const span = fixture_span('Internal only.');
        const breaking = span.find((c) => c.breaking);
        expect(breaking?.subject).toBe('rework the pipeline');
        expect(breaking?.trailers).toMatchObject({ impact: 'none', recorded: false });
        expect(release_impact_entry(span)).toEqual({ impact: 'none' });
    });

    it('reads the trailer of the same breaking commit into the release entry', () => {
        expect(release_impact_entry(fixture_span('Internal only.\n\nConsumer-Impact: action'))).toEqual({ impact: 'action' });
    });
});


describe('release impact map', () => {
    const sha = 'd'.repeat(40);
    const c = (body: string): Commit => commit_from_record({ sha, subject: 'feat: x', body });

    it('takes the strongest impact in the span and the security flag', () => {
        expect(
            release_impact_entry([
                c('Consumer-Impact: automatic'),
                c('Consumer-Impact: notice\nSecurity: yes'),
                c(''),
            ]),
        ).toEqual({ impact: 'notice', security: true });
    });

    it('omits a non-major release whose span is none throughout', () => {
        expect(with_release_impact({}, '2.1.0', [c(''), c('Consumer-Impact: none')])).toEqual({});
    });

    it('records a major even when its span is none, so absence can mean unrecorded', () => {
        expect(with_release_impact({}, '2.0.0', [c(''), c('Consumer-Impact: none')])).toEqual({
            '2.0.0': { impact: 'none' },
        });
    });

    it('keeps earlier entries and adds the new non-none one', () => {
        const prev = { '1.0.0': { impact: 'action' as const } };
        expect(with_release_impact(prev, '1.1.0', [c('Consumer-Impact: automatic')])).toEqual({
            '1.0.0': { impact: 'action' },
            '1.1.0': { impact: 'automatic' },
        });
    });

    it('set_package_version writes agentConfig.impact and omits none rows', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-impact-pkg-'));
        const p = path.join(tmp, 'package.json');
        fs.writeFileSync(p, JSON.stringify({ name: 'x', version: '1.0.0' }, null, 4) + '\n');
        set_package_version(p, '1.1.0', [c('Consumer-Impact: action')]);
        set_package_version(p, '1.2.0', [c('')]);
        const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
        expect(data['version']).toBe('1.2.0');
        expect(data['agentConfig']).toEqual({ impact: { '1.1.0': { impact: 'action' } } });
    });

    it('set_package_version without commits leaves the file shape unchanged', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-impact-pkg-'));
        const p = path.join(tmp, 'package.json');
        fs.writeFileSync(p, JSON.stringify({ name: 'x', version: '1.0.0' }, null, 4) + '\n');
        set_package_version(p, '1.0.1');
        expect(Object.keys(JSON.parse(fs.readFileSync(p, 'utf-8')) as object)).toEqual(['name', 'version']);
    });
});
