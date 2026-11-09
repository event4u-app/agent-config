import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CONTAINER_SYSPROMPT,
    container_argv,
    container_env,
    image_for,
    is_quota_exhausted,
    load_check,
    quota_brake,
    read_oauth_token,
    redact,
    TOKEN_ENV,
} from '../../internal/bench/core/_lib/bench_ab_container.js';
import { live_args } from '../../internal/bench/core/bench_ab_task_runner.js';

const IMAGE = `sha256:${'c'.repeat(64)}`;
const TOKEN = 'sk-ant-oat01-abcdefghijklmnop';

describe('container_argv', () => {
    it('runs the host CLI arguments in the image, with the clone as the working directory', () => {
        const cli = live_args('fix the bug', { model: 'claude-haiku-4-5', stream: true });
        const argv = container_argv({ image: IMAGE }, '/tmp/clone-1', cli);

        expect(argv.slice(0, 3)).toEqual(['run', '--rm', '--init']);
        expect(argv).toContain('/tmp/clone-1:/work');
        const at = argv.indexOf(IMAGE);
        expect(argv[at + 1]).toBe('claude');
        expect(argv.slice(at + 2)).toEqual(cli);
    });

    it('passes the token by name only — its value never appears on the argv', () => {
        const argv = container_argv({ image: IMAGE }, '/c', live_args('p', {}));
        expect(argv[argv.indexOf('-e') + 1]).toBe(TOKEN_ENV);
        expect(argv.join(' ')).not.toContain(TOKEN);
    });

    it('gives every arm identical CLI flags: --setting-sources is dropped', () => {
        const vanilla = container_argv({ image: IMAGE }, '/c', live_args('p', { setting_sources: 'project,local', stream: true }));
        const pkg = container_argv({ image: IMAGE }, '/c', live_args('p', { setting_sources: null, stream: true }));
        expect(vanilla).toEqual(pkg);
        expect(vanilla).not.toContain('--setting-sources');
    });

    it('mounts an injected prompt file read-only and points the CLI at the mount', () => {
        const argv = container_argv({ image: IMAGE }, '/c', live_args('p', { sysprompt_file: '/host/sp.txt' }));
        expect(argv).toContain(`/host/sp.txt:${CONTAINER_SYSPROMPT}:ro`);
        expect(argv[argv.indexOf('--append-system-prompt-file') + 1]).toBe(CONTAINER_SYSPROMPT);
    });
});

describe('container_env', () => {
    it('always drops a credential that would override the subscription, and sets the token', () => {
        const env = container_env({ PATH: '/bin', ANTHROPIC_API_KEY: 'sk-ant-api', ANTHROPIC_BASE_URL: 'http://x', HOME: '/h' }, TOKEN);
        expect(env).toEqual({ PATH: '/bin', HOME: '/h', [TOKEN_ENV]: TOKEN });
    });
});

describe('read_oauth_token', () => {
    const file = (mode: number, body = `${TOKEN}\n`): string => {
        const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tok-')), 'claude-oauth-token');
        fs.writeFileSync(f, body);
        fs.chmodSync(f, mode);
        return f;
    };

    it('reads a 0600 token file and trims it', () => {
        expect(read_oauth_token({}, file(0o600))).toBe(TOKEN);
    });

    it('refuses a token file other users can read', () => {
        expect(() => read_oauth_token({}, file(0o644))).toThrow(/chmod 600/);
    });

    it('prefers the environment and rejects a value that is not one token', () => {
        expect(read_oauth_token({ [TOKEN_ENV]: TOKEN }, '/missing')).toBe(TOKEN);
        expect(() => read_oauth_token({ [TOKEN_ENV]: 'two words' }, '/missing')).toThrow(/single token/);
    });

    it('names the setup command when nothing is configured', () => {
        expect(() => read_oauth_token({}, '/missing/token')).toThrow(/claude setup-token/);
    });
});

describe('redact', () => {
    it('removes every occurrence of the token', () => {
        expect(redact(`a ${TOKEN} b ${TOKEN}`, TOKEN)).toBe('a [REDACTED] b [REDACTED]');
    });
});

describe('load_check', () => {
    const pkg = new Set(['laravel', 'code-review-lens']);
    const init = (skills: string[]): string => `${JSON.stringify({ type: 'system', subtype: 'init', skills, plugins: [] })}\n{"type":"result"}`;

    it('accepts a package image that loaded package skills and a base image that loaded none', () => {
        expect(load_check(init(['laravel', 'code-review-lens', 'init']), true, pkg)).toMatchObject({ ok: true, package_skills: 2 });
        expect(load_check(init(['init', 'review']), false, pkg)).toMatchObject({ ok: true, package_skills: 0 });
    });

    it('rejects a package image whose run loaded no package skill', () => {
        expect(load_check(init(['init']), true, pkg)).toMatchObject({ ok: false, reason: expect.stringMatching(/no package skill/) });
    });

    it('rejects a base image whose run loaded a package skill', () => {
        expect(load_check(init(['laravel']), false, pkg)).toMatchObject({ ok: false, package_skills: 1 });
    });

    it('rejects a run with no init event', () => {
        expect(load_check('{"type":"result"}', false, pkg).ok).toBe(false);
    });
});

describe('quota brake', () => {
    const empty = { errored: true, reason: 'exit 1', tokens_breakdown: {} };
    const limited = { errored: true, reason: 'error', transcript: "You've hit your usage limit", tokens_breakdown: { input_tokens: 40 } };
    const worked = { errored: false, tokens_breakdown: { input_tokens: 900 } };

    it('classes a zero-token error and a usage-limit message as exhausted, and real work as not', () => {
        expect(is_quota_exhausted(empty)).toBe(true);
        expect(is_quota_exhausted(limited)).toBe(true);
        expect(is_quota_exhausted(worked)).toBe(false);
        expect(is_quota_exhausted({ errored: true, reason: 'error_max_turns', tokens_breakdown: { input_tokens: 5000 } })).toBe(false);
    });

    it('stops the sweep on the third consecutive exhausted run, not before', () => {
        const brake = quota_brake(3);
        expect(brake(empty)).toBeNull();
        expect(brake(limited)).toBeNull();
        expect(brake(empty)).toMatch(/3 consecutive runs did no work/);
    });

    it('resets the streak when a run does work in between', () => {
        const brake = quota_brake(3);
        brake(empty);
        brake(empty);
        expect(brake(worked)).toBeNull();
        expect(brake(empty)).toBeNull();
    });
});

describe('token pool', async () => {
    const { next_account_hint, read_token_pool, select_account } = await import('../../internal/bench/core/_lib/bench_ab_container.js');
    const dir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'pool-'));
    const put = (d: string, name: string, body: string, mode = 0o600): void => {
        fs.writeFileSync(path.join(d, name), body);
        fs.chmodSync(path.join(d, name), mode);
    };

    it('reads the single file and one file per account, sorted, without duplicates', () => {
        const d = dir();
        const pool = path.join(d, 'pool');
        fs.mkdirSync(pool);
        put(d, 'single', 'tok-a');
        put(pool, 'b-account', 'tok-b');
        put(pool, 'a-account', 'tok-a');
        expect(read_token_pool({}, path.join(d, 'single'), pool).map((e) => e.name)).toEqual(['default', 'b-account']);
    });

    it('holds every pool file to the 0600 rule', () => {
        const d = dir();
        put(d, 'open', 'tok', 0o644);
        expect(() => read_token_pool({}, path.join(d, 'none'), d)).toThrow(/chmod 600/);
    });

    it('runs on the named account or the first one, and never picks another on its own', () => {
        const pool = [{ name: 'a', token: 't1' }, { name: 'b', token: 't2' }];
        expect(select_account(pool).name).toBe('a');
        expect(select_account(pool, 'b').token).toBe('t2');
        expect(() => select_account(pool, 'c')).toThrow(/configured: a, b/);
    });

    it('tells the operator where a stopped sweep can resume, naming accounts only', () => {
        const pool = [{ name: 'a', token: 'tok-1' }, { name: 'b', token: 'tok-2' }];
        expect(next_account_hint(pool, 'a')).toMatch(/--account <name> \(configured: b\)/);
        expect(next_account_hint(pool, 'a')).not.toContain('tok-');
        expect(next_account_hint([{ name: 'a', token: 'x' }], 'a')).toMatch(/no other account/);
    });
});

describe('image_for', () => {
    const ctx = { base_image: 'base', ac_image: 'reduced', token: TOKEN, package_skills: new Set<string>() };

    it('runs a package arm on the default image and a control arm on the base image', () => {
        expect(image_for(ctx, { setting_sources: null })).toBe('reduced');
        expect(image_for(ctx, { setting_sources: 'project,local' })).toBe('base');
    });

    it('runs the full-layer arm on the full image', () => {
        expect(image_for({ ...ctx, ac_full_image: 'full' }, { setting_sources: null, ac_layer: 'full' })).toBe('full');
    });

    it('refuses the full-layer arm when that image was not built, rather than running it on the default one', () => {
        expect(() => image_for(ctx, { setting_sources: null, ac_layer: 'full' })).toThrow(/--with-full-layer/);
    });
});
