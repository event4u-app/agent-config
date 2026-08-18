
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    CODEX_MEASURED_UNSERVABLE,
    OPENAI_CLI_VENDOR_DEFAULT,
} from '../../../src/scripts/ai_council/clients';
import * as cfg from '../../../src/scripts/ai_council/config';

const _REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-test-')));
    tmp_dirs.push(dir);
    return dir;
}

function patch_env(key: string, value: string | undefined): void {
    saved_env.push([key, process.env[key]]);
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}

function write_file(p: string, body: string): string {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

/** Mirror `_write_yaml(tmp_path, payload_text)`: writes `.ai-council.yml`. */
function write_yaml(tmp: string, body: string): string {
    return write_file(path.join(tmp, '.ai-council.yml'), body);
}

afterEach(() => {
    while (saved_env.length > 0) {
        const [key, value] = saved_env.pop() as [string, string | undefined];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

// === tests/ai_council/test_config.py =======================================

const MINIMAL_VALID = `enabled: true
defaults:
  mode: api
cost_budget:
  max_total_usd: 20.0
members:
  anthropic:
    enabled: true
    model: claude-x
    api_key_ref: env:ANTHROPIC_KEY
`;

describe('load_council_config — happy path', () => {
    it('minimal valid round-trip', () => {
        const tmp = make_tmp();
        const c = cfg.load_council_config(write_yaml(tmp, MINIMAL_VALID));
        expect(c.enabled).toBe(true);
        // `auto` is the ONLY value this loader emits — see `_build_defaults`.
        expect(c.defaults.mode).toBe('auto');
        expect(c.cost_budget.max_total_usd).toBe(20.0);
        const member = c.members.get('anthropic');
        expect(member).toBeDefined();
        expect(member!.enabled).toBe(true);
        expect(member!.model).toBe('claude-x');
        expect(member!.api_key_ref).toBe('env:ANTHROPIC_KEY');
    });

    it('zero disables usd ceiling but is accepted', () => {
        const tmp = make_tmp();
        const payload = MINIMAL_VALID.replace('max_total_usd: 20.0', 'max_total_usd: 0');
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.cost_budget.max_total_usd).toBe(0.0);
    });

    it('stance_tally defaults to disabled when the block is absent (Phase 1)', () => {
        const tmp = make_tmp();
        const c = cfg.load_council_config(write_yaml(tmp, MINIMAL_VALID));
        expect(c.stance_tally.enabled).toBe(false);
    });

    it('stance_tally.enabled: true is honoured', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}\nstance_tally:\n  enabled: true\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.stance_tally.enabled).toBe(true);
    });

    it('stance_tally.enabled non-bool is rejected', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}\nstance_tally:\n  enabled: "yes"\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(
            /stance_tally\.enabled.*bool/,
        );
    });

    it('chairman defaults to host synthesis (Phase 2)', () => {
        const c = cfg.load_council_config(write_yaml(make_tmp(), MINIMAL_VALID));
        expect(c.chairman.mode).toBe('host');
        expect(c.chairman.member).toBeNull();
    });

    it('chairman.mode enum is validated', () => {
        const payload = `${MINIMAL_VALID}\nchairman:\n  mode: bogus\n`;
        expect(() => cfg.load_council_config(write_yaml(make_tmp(), payload))).toThrow(
            /chairman\.mode/,
        );
    });

    it('chairman mode:member with a valid enabled member is honoured', () => {
        const payload = `${MINIMAL_VALID}\nchairman:\n  mode: member\n  member: anthropic\n`;
        const c = cfg.load_council_config(write_yaml(make_tmp(), payload));
        expect(c.chairman.mode).toBe('member');
        expect(c.chairman.member).toBe('anthropic');
    });

    it('chairman mode:member fails closed when the member is absent', () => {
        const payload = `${MINIMAL_VALID}\nchairman:\n  mode: member\n  member: mistral\n`;
        expect(() => cfg.load_council_config(write_yaml(make_tmp(), payload))).toThrow(
            /no such member/,
        );
    });

    it('chairman mode:member fails closed when member is unset', () => {
        const payload = `${MINIMAL_VALID}\nchairman:\n  mode: member\n`;
        expect(() => cfg.load_council_config(write_yaml(make_tmp(), payload))).toThrow(
            /member.*is unset/,
        );
    });

    it('members.<name>.tier is optional (null when unset), honoured when set', () => {
        const c = cfg.load_council_config(write_yaml(make_tmp(), MINIMAL_VALID));
        expect(c.members.get('anthropic')!.tier).toBeNull();
        const payload = MINIMAL_VALID.replace(
            'api_key_ref: env:ANTHROPIC_KEY',
            'api_key_ref: env:ANTHROPIC_KEY\n    tier: 3',
        );
        const c2 = cfg.load_council_config(write_yaml(make_tmp(), payload));
        expect(c2.members.get('anthropic')!.tier).toBe(3);
    });

    it('members.<name>.tier rejects non-integer / < 1 values', () => {
        const payload = MINIMAL_VALID.replace(
            'api_key_ref: env:ANTHROPIC_KEY',
            'api_key_ref: env:ANTHROPIC_KEY\n    tier: 0',
        );
        expect(() => cfg.load_council_config(write_yaml(make_tmp(), payload))).toThrow(
            /tier must be an integer/,
        );
    });

    it('members.<name>.prompt_cache.ttl defaults to 5m when unset', () => {
        const c = cfg.load_council_config(write_yaml(make_tmp(), MINIMAL_VALID));
        expect(c.members.get('anthropic')!.prompt_cache_ttl).toBe('5m');
    });

    it('members.<name>.prompt_cache: false (the pre-existing bool form) leaves ttl at 5m', () => {
        const payload = MINIMAL_VALID.replace(
            'api_key_ref: env:ANTHROPIC_KEY',
            'api_key_ref: env:ANTHROPIC_KEY\n    prompt_cache: false',
        );
        const c = cfg.load_council_config(write_yaml(make_tmp(), payload));
        expect(c.members.get('anthropic')!.prompt_cache_ttl).toBe('5m');
    });

    it('members.<name>.prompt_cache.ttl: 1h is honoured (an explicit, gated override)', () => {
        const payload = MINIMAL_VALID.replace(
            'api_key_ref: env:ANTHROPIC_KEY',
            'api_key_ref: env:ANTHROPIC_KEY\n    prompt_cache:\n      ttl: 1h',
        );
        const c = cfg.load_council_config(write_yaml(make_tmp(), payload));
        expect(c.members.get('anthropic')!.prompt_cache_ttl).toBe('1h');
    });

    it('members.<name>.prompt_cache.ttl rejects a value outside {5m, 1h}', () => {
        const payload = MINIMAL_VALID.replace(
            'api_key_ref: env:ANTHROPIC_KEY',
            'api_key_ref: env:ANTHROPIC_KEY\n    prompt_cache:\n      ttl: 10m',
        );
        expect(() => cfg.load_council_config(write_yaml(make_tmp(), payload))).toThrow(
            /prompt_cache\.ttl must be '5m' or '1h'/,
        );
    });

    it('members.<name>.prompt_cache rejects a non-bool, non-mapping value', () => {
        const payload = MINIMAL_VALID.replace(
            'api_key_ref: env:ANTHROPIC_KEY',
            'api_key_ref: env:ANTHROPIC_KEY\n    prompt_cache: "yes"',
        );
        expect(() => cfg.load_council_config(write_yaml(make_tmp(), payload))).toThrow(
            /prompt_cache must be a bool or a mapping/,
        );
    });

    it('debate_gates and restate default to disabled (Phase 3)', () => {
        const c = cfg.load_council_config(write_yaml(make_tmp(), MINIMAL_VALID));
        expect(c.debate_gates.enabled).toBe(false);
        expect(c.restate.enabled).toBe(false);
    });

    it('debate_gates.enabled: true is honoured', () => {
        const payload = `${MINIMAL_VALID}\ndebate_gates:\n  enabled: true\n`;
        const c = cfg.load_council_config(write_yaml(make_tmp(), payload));
        expect(c.debate_gates.enabled).toBe(true);
    });

    it('critic_protocol defaults to legacy', () => {
        const c = cfg.load_council_config(write_yaml(make_tmp(), MINIMAL_VALID));
        expect(c.critic_protocol).toBe('legacy');
    });

    it('critic_protocol: load_bearing is honoured', () => {
        const payload = `${MINIMAL_VALID}\ncritic_protocol: load_bearing\n`;
        const c = cfg.load_council_config(write_yaml(make_tmp(), payload));
        expect(c.critic_protocol).toBe('load_bearing');
    });

    it('critic_protocol rejects unknown values', () => {
        const payload = `${MINIMAL_VALID}\ncritic_protocol: freeform\n`;
        expect(() => cfg.load_council_config(write_yaml(make_tmp(), payload))).toThrow(
            /critic_protocol.*not in/,
        );
    });

    it('per-member mode override precedence', () => {
        const tmp = make_tmp();
        const payload = `enabled: true
defaults:
  mode: manual
members:
  anthropic:
    enabled: true
    model: claude-x
    mode: api
    api_key_ref: env:ANTHROPIC_KEY
  openai:
    enabled: true
    model: gpt-x
`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        // Transport is resolved per machine, never configured — a member that
        // still spells `mode:` out is loaded, ignored, and reported. Reading it
        // is what let a pre-flip config keep paying per token forever.
        expect(c.members.get('anthropic')!.mode).toBeNull();
        expect(c.members.get('openai')!.mode).toBeNull();
        expect(c.ignored_transport_keys).toContain('members.anthropic.mode');
    });

    it('disabled member allows omitted key and model', () => {
        const tmp = make_tmp();
        const payload = `enabled: false
members:
  anthropic:
    enabled: false
  openai:
    enabled: false
`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.members.get('anthropic')!.model).toBe('');
        expect(c.members.get('anthropic')!.api_key_ref).toBeNull();
    });
});

describe('load_council_config — validation errors', () => {
    it('missing file is a clear error', () => {
        const tmp = make_tmp();
        const missing = path.join(tmp, 'nope.yml');
        expect(() => cfg.load_council_config(missing)).toThrow(cfg.CouncilConfigError);
        expect(() => cfg.load_council_config(missing)).toThrow(/not found/);
    });

    it('top-level list is rejected', () => {
        const tmp = make_tmp();
        const p = write_yaml(tmp, '- a\n- b\n');
        expect(() => cfg.load_council_config(p)).toThrow(/mapping/);
    });

    it('enabled must be a bool', () => {
        const tmp = make_tmp();
        const p = write_yaml(tmp, 'enabled: 5\n');
        expect(() => cfg.load_council_config(p)).toThrow(/enabled.*bool/);
    });

    it('a bogus default mode no longer fails the load — the key is not read at all', () => {
        const tmp = make_tmp();
        const p = write_yaml(tmp, 'enabled: false\ndefaults:\n  mode: bogus\n');
        // Validating a key nobody reads would turn every stale config into a
        // hard load failure, which is the breaking change the ignore-list
        // exists to avoid. Accept, ignore, report.
        const c = cfg.load_council_config(p);
        expect(c.defaults.mode).toBe('auto');
        expect(c.ignored_transport_keys).toContain('defaults.mode');
    });

    it('a bogus member mode is likewise ignored rather than rejected', () => {
        const tmp = make_tmp();
        const p = write_yaml(
            tmp,
            'enabled: false\nmembers:\n  anthropic:\n    enabled: false\n    mode: weird\n',
        );
        const c = cfg.load_council_config(p);
        expect(c.members.get('anthropic')!.mode).toBeNull();
        expect(c.ignored_transport_keys).toContain('members.anthropic.mode');
    });

    it('a config that never carried a transport key reports none ignored', () => {
        const tmp = make_tmp();
        const p = write_yaml(tmp, 'enabled: false\nmembers:\n  anthropic:\n    enabled: false\n');
        expect(cfg.load_council_config(p).ignored_transport_keys).toEqual([]);
    });

    it('unknown provider is rejected', () => {
        const tmp = make_tmp();
        const p = write_yaml(tmp, 'enabled: false\nmembers:\n  zzz:\n    enabled: false\n');
        expect(() => cfg.load_council_config(p)).toThrow(/unknown provider/);
    });

    it('enabled member without model fails', () => {
        const tmp = make_tmp();
        const p = write_yaml(tmp, 'enabled: false\nmembers:\n  anthropic:\n    enabled: true\n');
        expect(() => cfg.load_council_config(p)).toThrow(/non-empty `model`/);
    });

    it('an enabled member without api_key_ref loads — the key is a fallback credential, not a requirement', () => {
        const tmp = make_tmp();
        // Every member now resolves through the auto chain, whose first rung is
        // the key-free `cli` transport. Demanding an API key up front would
        // refuse to load exactly the subscription-only machine this change
        // exists to serve; a missing key simply makes the `api` fallback rung
        // unavailable, which `resolveTransport` reports at call time.
        const p = write_yaml(
            tmp,
            'enabled: false\nmembers:\n  anthropic:\n    enabled: true\n    model: m\n    mode: api\n',
        );
        const c = cfg.load_council_config(p);
        expect(c.members.get('anthropic')!.api_key_ref).toBeNull();
        expect(c.ignored_transport_keys).toContain('members.anthropic.mode');
    });

    it('api_key_ref must use a known prefix', () => {
        const tmp = make_tmp();
        const p = write_yaml(
            tmp,
            'enabled: false\nmembers:\n  anthropic:\n    enabled: false\n    api_key_ref: weird\n',
        );
        expect(() => cfg.load_council_config(p)).toThrow(/must start with/);
    });

    it('api_key_ref empty file body rejected', () => {
        const tmp = make_tmp();
        const p = write_yaml(
            tmp,
            'enabled: false\nmembers:\n  anthropic:\n    enabled: false\n    api_key_ref: "file:"\n',
        );
        expect(() => cfg.load_council_config(p)).toThrow(/missing path/);
    });

    it('api_key_ref empty env body rejected', () => {
        const tmp = make_tmp();
        const p = write_yaml(
            tmp,
            'enabled: false\nmembers:\n  anthropic:\n    enabled: false\n    api_key_ref: "env:"\n',
        );
        expect(() => cfg.load_council_config(p)).toThrow(/missing variable name/);
    });

    it('api_key_ref raw-key shape rejected', () => {
        const tmp = make_tmp();
        const p = write_yaml(
            tmp,
            'enabled: false\nmembers:\n  anthropic:\n    enabled: false\n    api_key_ref: sk-ant-abc\n',
        );
        expect(() => cfg.load_council_config(p)).toThrow(/raw API key/);
    });

    it('negative cost_budget rejected', () => {
        const tmp = make_tmp();
        const p = write_yaml(tmp, 'enabled: false\ncost_budget:\n  max_total_usd: -1\n');
        expect(() => cfg.load_council_config(p)).toThrow(/must be >= 0/);
    });
});

// === resolve_api_key — env + file ==========================================

describe('resolve_api_key', () => {
    it('env happy path', () => {
        patch_env('AGENT_CONFIG_TEST_KEY', 'topsecret');
        expect(cfg.resolve_api_key('env:AGENT_CONFIG_TEST_KEY')).toBe('topsecret');
    });

    it('env missing raises', () => {
        patch_env('AGENT_CONFIG_TEST_MISSING', undefined);
        expect(() => cfg.resolve_api_key('env:AGENT_CONFIG_TEST_MISSING')).toThrow(
            /unset or empty/,
        );
    });

    it('file bad permissions raises', () => {
        const tmp = make_tmp();
        const key = path.join(tmp, 'key.txt');
        fs.writeFileSync(key, 'secret');
        fs.chmodSync(key, 0o644);
        expect(() => cfg.resolve_api_key(`file:${key}`)).toThrow(/unsafe permissions/);
    });

    it('file 0600 happy path', () => {
        const tmp = make_tmp();
        const key = path.join(tmp, 'key.txt');
        fs.writeFileSync(key, '  secret-key  \n');
        fs.chmodSync(key, 0o600);
        expect(cfg.resolve_api_key(`file:${key}`)).toBe('secret-key');
    });
});

// === tests/ai_council/test_config_resolution.py ============================

describe('resolve_config_path — precedence', () => {
    function sandbox(tmp: string): {
        env: Record<string, string>;
        globalCfg: string;
        project: string;
    } {
        const root = path.join(tmp, 'global-root');
        fs.mkdirSync(path.join(root, 'settings'), { recursive: true });
        const env: Record<string, string> = {
            ...(process.env as Record<string, string>),
            EVENT4U_CONFIG_HOME: root,
        };
        delete env[cfg.COUNCIL_CONFIG_ENV];
        const project = path.join(tmp, 'proj');
        fs.mkdirSync(project, { recursive: true });
        const globalCfg = path.join(root, cfg.COUNCIL_CONFIG_USER_GLOBAL_REL);
        return { env, globalCfg, project };
    }

    it('global used when no project file', () => {
        const tmp = make_tmp();
        const { env, globalCfg, project } = sandbox(tmp);
        write_file(globalCfg, 'enabled: false\n');
        expect(cfg.resolve_config_path(project, { env })).toBe(globalCfg);
    });

    it('project file is ignored — council config is always user-global (ADR-104)', () => {
        const tmp = make_tmp();
        const { env, globalCfg, project } = sandbox(tmp);
        write_file(globalCfg, 'enabled: false\n');
        // A project-local council file MUST NOT be picked up: the council
        // never searches the project tree (ADR-104, supersedes ADR-093's
        // project-local override).
        write_file(
            path.join(project, 'agents', 'settings', cfg.COUNCIL_CONFIG_RELNAME),
            'enabled: false\n',
        );
        expect(cfg.resolve_config_path(project, { env })).toBe(globalCfg);
    });

    it('env override wins', () => {
        const tmp = make_tmp();
        const { env, globalCfg, project } = sandbox(tmp);
        write_file(globalCfg, 'enabled: false\n');
        const explicit = write_file(path.join(tmp, 'explicit.yml'), 'enabled: false\n');
        env[cfg.COUNCIL_CONFIG_ENV] = explicit;
        expect(cfg.resolve_config_path(project, { env })).toBe(explicit);
    });

    it('env override honoured even when absent', () => {
        const tmp = make_tmp();
        const { env, project } = sandbox(tmp);
        const missing = path.join(tmp, 'missing.yml');
        env[cfg.COUNCIL_CONFIG_ENV] = missing;
        expect(cfg.resolve_config_path(project, { env })).toBe(missing);
    });

    it('falls back to global write target when nothing exists', () => {
        const tmp = make_tmp();
        const { env, globalCfg, project } = sandbox(tmp);
        // No global file written, no project file → write target.
        expect(cfg.resolve_config_path(project, { env })).toBe(globalCfg);
    });
});

/** JSON-able view of the TS config that matches the Python `to_jsonable`. */
function _ts_jsonable(c: cfg.CouncilConfig): Record<string, unknown> {
    const map = <V>(m: ReadonlyMap<string, V>, fn?: (v: V) => unknown): Record<string, unknown> => {
        const o: Record<string, unknown> = {};
        for (const [k, v] of m) {
            o[k] = fn ? fn(v) : (v as unknown);
        }
        return o;
    };
    return {
        enabled: c.enabled,
        defaults: { ...c.defaults },
        cost_budget: { ...c.cost_budget },
        members: map(c.members, (m) => ({ ...m, model_ladder: [...m.model_ladder] })),
        advisors: map(c.advisors, (a) => ({ ...a })),
        consensus_scoring: { ...c.consensus_scoring, lenses: [...c.consensus_scoring.lenses] },
        cli_call_budget: {
            max_calls_per_day: map(c.cli_call_budget.max_calls_per_day),
            warn_at: c.cli_call_budget.warn_at,
        },
        necessity_classifier: { ...c.necessity_classifier },
        model_downgrade: { ...c.model_downgrade },
        debate: { ...c.debate, cost_disclosure: { ...c.debate.cost_disclosure } },
        decision_replay: { ...c.decision_replay },
        decision_resolution: {
            enabled: c.decision_resolution.enabled,
            classes: map(c.decision_resolution.classes, (e) => ({ ...e })),
            fast_path: {
                ...c.decision_resolution.fast_path,
                fuzzy_match: { ...c.decision_resolution.fast_path.fuzzy_match },
            },
        },
        routing: {
            ...c.routing,
            solo_member_fallback_chain: [...c.routing.solo_member_fallback_chain],
        },
        low_impact: { ...c.low_impact },
        lens_overrides: {
            necessity_classifier_mode: map(c.lens_overrides.necessity_classifier_mode),
            necessity_classifier_user_explicit_mode: map(
                c.lens_overrides.necessity_classifier_user_explicit_mode,
            ),
            model_downgrade: map(c.lens_overrides.model_downgrade, (v) => ({ ...v })),
            cost_disclosure: map(c.lens_overrides.cost_disclosure, (v) => ({ ...v })),
            decision_replay: map(c.lens_overrides.decision_replay, (v) => ({ ...v })),
        },
    };
}

const _FULL_FIXTURE = `enabled: true
defaults:
  mode: cli
  member_mode: api
  min_rounds: 3
  deep_min_rounds: 4
  max_output_tokens: 1000
  session_retention_days: 14
  debate_max_rounds: 5
cost_budget:
  max_input_tokens: 100000
  max_output_tokens: 50000
  max_calls: 10
  max_total_usd: 7.5
members:
  anthropic:
    enabled: true
    model: claude-x
    mode: cli
    binary: claude
    model_ladder: [claude-x, claude-y]
    participate_low_impact: true
  openai:
    enabled: true
    model: gpt-x
    mode: api
    api_key_ref: env:OPENAI_KEY
  gemini:
    enabled: false
advisors:
  sage:
    enabled: true
    member: openai
    model: gpt-pro
consensus_scoring:
  enabled: true
  strong_threshold: 0.8
  minority_threshold: 0.3
  lenses: [analysis, design]
cli_call_budget:
  max_calls_per_day:
    anthropic: 40
    openai: 20
  warn_at: 0.75
necessity_classifier:
  enabled: false
  mode: block
  user_explicit_mode: "off"
model_downgrade:
  enabled: false
  auto_apply: true
debate:
  max_cost_usd: 3.0
  cost_disclosure:
    mode: above_threshold
    threshold_usd: 0.5
    show_per_member: false
decision_replay:
  enabled: false
  include_member_arguments: false
decision_resolution:
  enabled: true
  classes:
    trivial:
      mode: agent
      confidence_threshold: 0.5
    medium_impact:
      mode: council
      confidence_threshold: 0.9
  fast_path:
    max_members: 1
    max_tokens: 1800
    max_cost_usd: 0.04
    fuzzy_match:
      enabled: true
      threshold: 0.95
routing:
  solo_member_fallback_chain: [openai, anthropic]
  auth_check_timeout_seconds: 10
low_impact:
  dispatch: single
  shadow_sample_rate: 0.25
  solo_confidence_floor: 0.6
lenses:
  analysis:
    necessity_classifier:
      mode: warn-only
      user_explicit_mode: educate
    model_downgrade:
      enabled: false
      auto_apply: true
    cost_disclosure:
      mode: "off"
      threshold_usd: 2.0
    decision_replay:
      enabled: false
`;

describe('cost_budget.daily_limit_usd — the rolling 24h cap (and the ledger switch)', () => {
    // The field existed on CostBudget and gated the spend-ledger append, but no
    // caller ever passed it and the typed parse dropped the key — so the ledger
    // could not be written at all while an archived acceptance criterion claimed
    // otherwise. These pin the whole chain: raw YAML -> typed config -> validation.
    it('defaults to 0, which keeps both the cap and the ledger off', () => {
        const tmp = make_tmp();
        const c = cfg.load_council_config(write_yaml(tmp, MINIMAL_VALID));
        expect(c.cost_budget.daily_limit_usd).toBe(0);
    });

    it('parses an explicit cap out of cost_budget', () => {
        const tmp = make_tmp();
        const payload = MINIMAL_VALID.replace('  max_total_usd: 20.0', '  max_total_usd: 20.0\n  daily_limit_usd: 5.0');
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.cost_budget.daily_limit_usd).toBe(5.0);
    });

    it('rejects a negative cap like every sibling budget field', () => {
        const tmp = make_tmp();
        const payload = MINIMAL_VALID.replace('  max_total_usd: 20.0', '  max_total_usd: 20.0\n  daily_limit_usd: -1');
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(/daily_limit_usd must be >= 0/u);
    });
});

// === road-to-always-on-orchestration Phase 3.1 — CLI-first shipped default ===

describe('transport is resolved, not configured — the mode key is ignored', () => {
    it('defaults to auto when the config omits `defaults` entirely', () => {
        const tmp = make_tmp();
        const payload = 'enabled: true\nmembers:\n  anthropic:\n    enabled: false\n';
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.defaults.mode).toBe('auto');
    });

    it('defaults to auto when `defaults:` is present but `mode:` is omitted', () => {
        const tmp = make_tmp();
        const payload = 'enabled: true\ndefaults:\n  min_rounds: 3\nmembers:\n  anthropic:\n    enabled: false\n';
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.defaults.mode).toBe('auto');
    });

    it('a member with no explicit mode inherits the default (per-member mode stays null)', () => {
        const tmp = make_tmp();
        const payload =
            'enabled: true\nmembers:\n  anthropic:\n    enabled: true\n    model: claude-x\n    binary: claude\n';
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.members.get('anthropic')!.mode).toBeNull();
    });

    it('an auto-mode enabled member with no api_key_ref does not fail load — auto may resolve to cli', () => {
        const tmp = make_tmp();
        const payload = 'enabled: true\nmembers:\n  anthropic:\n    enabled: true\n    model: claude-x\n';
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).not.toThrow();
    });

    it('a pinned `mode: api` no longer survives — a per-member pin was the last silent-spend path', () => {
        const tmp = make_tmp();
        const payload =
            'enabled: true\nmembers:\n  anthropic:\n    enabled: true\n    model: claude-x\n    mode: api\n';
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.members.get('anthropic')!.mode).toBeNull();
        expect(c.ignored_transport_keys).toEqual(['members.anthropic.mode']);
    });

    it('a pinned `mode: manual` / `mode: cli` is ignored too — one rule for every value, no exceptions', () => {
        for (const mode of ['manual', 'cli']) {
            const tmp = make_tmp();
            const payload = `enabled: true\nmembers:\n  anthropic:\n    enabled: true\n    model: claude-x\n    mode: ${mode}\n`;
            const c = cfg.load_council_config(write_yaml(tmp, payload));
            // Ignoring only the paid value would leave `mode:` half-alive and
            // reintroduce the two-defaults confusion this change removes.
            // `manual` stays reachable per invocation via `--mode-override`.
            expect(c.members.get('anthropic')!.mode).toBeNull();
            expect(c.ignored_transport_keys).toEqual(['members.anthropic.mode']);
        }
    });

    it('both layers are reported when both carry a stale key', () => {
        const tmp = make_tmp();
        const payload =
            'enabled: true\ndefaults:\n  mode: api\nmembers:\n  anthropic:\n    enabled: true\n    model: claude-x\n    mode: api\n';
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.ignored_transport_keys).toEqual(['defaults.mode', 'members.anthropic.mode']);
    });
});

// === road-to-always-on-orchestration Phase 3.3 — quorum ===

describe('quorum — config validation (Phase 3.3)', () => {
    it('defaults to "majority" when omitted', () => {
        const tmp = make_tmp();
        const c = cfg.load_council_config(write_yaml(tmp, MINIMAL_VALID));
        expect(c.quorum).toBe('majority');
    });

    it('accepts an explicit "majority"', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum: majority\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.quorum).toBe('majority');
    });

    it('accepts a positive integer', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum: 2\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.quorum).toBe(2);
    });

    it('rejects zero', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum: 0\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(/quorum.*integer >= 1/);
    });

    it('rejects a negative integer', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum: -1\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(/quorum.*integer >= 1/);
    });

    it('rejects an unrecognised string', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum: all\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(/quorum.*majority/);
    });

    it('rejects a boolean', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum: true\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(/quorum/);
    });

    it('rejects a float', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum: 1.5\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(/quorum/);
    });
});

// === ADR-224 — quorum_min_present (the shadow floor) ===

describe('quorum_min_present — config validation (ADR-224)', () => {
    it('defaults to the ADR-224 value when omitted', () => {
        // Deliberately NOT defaulting to "unset": an unset floor records
        // nothing, and ADR-224's review trigger (b) is "the floor lands and
        // its own fire-rate telemetry accumulates". A default of 2 is what
        // makes that trigger reachable without an operator edit.
        const tmp = make_tmp();
        const c = cfg.load_council_config(write_yaml(tmp, MINIMAL_VALID));
        expect(c.quorum_min_present).toBe(2);
    });

    it('accepts a positive integer', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum_min_present: 3\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.quorum_min_present).toBe(3);
    });

    it('accepts 1 — the operator disabling the counterfactual', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum_min_present: 1\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.quorum_min_present).toBe(1);
    });

    it('accepts a floor above any plausible roster — clamped per pass, not at load', () => {
        // Rejecting this at load would refuse a config that becomes
        // legitimate the moment a member is added; `wouldSoloFloorHold`
        // clamps where `total` is actually known.
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum_min_present: 99\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.quorum_min_present).toBe(99);
    });

    it('rejects zero', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum_min_present: 0\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(
            /quorum_min_present.*integer >= 1/,
        );
    });

    it('rejects a boolean', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum_min_present: true\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(
            /quorum_min_present/,
        );
    });

    it('rejects a float', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum_min_present: 1.5\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(
            /quorum_min_present/,
        );
    });

    it('rejects a string', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}quorum_min_present: two\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(
            /quorum_min_present/,
        );
    });
});

// === road-to-always-on-orchestration Phase 3.4 — cli_call_budget per-provider defaults ===

describe('cli_call_budget.max_calls_per_day — generous per-provider defaults (Phase 3.4)', () => {
    it('ships every known provider populated (50/day) when the block is entirely absent', () => {
        const tmp = make_tmp();
        const c = cfg.load_council_config(write_yaml(tmp, MINIMAL_VALID));
        const caps = c.cli_call_budget.max_calls_per_day;
        expect(caps.get('anthropic')).toBe(50);
        expect(caps.get('openai')).toBe(50);
        expect(caps.get('gemini')).toBe(50);
        expect(caps.get('xai')).toBe(50);
        expect(caps.get('perplexity')).toBe(50);
    });

    it('an explicit per-provider entry overrides just that provider, leaving the rest at the default', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}cli_call_budget:\n  max_calls_per_day:\n    anthropic: 5\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        const caps = c.cli_call_budget.max_calls_per_day;
        expect(caps.get('anthropic')).toBe(5);
        expect(caps.get('openai')).toBe(50);
        expect(caps.get('perplexity')).toBe(50);
    });

    it('an explicit 0 (deliberately no calls allowed) is honoured, not treated as "use the default"', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}cli_call_budget:\n  max_calls_per_day:\n    anthropic: 0\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.cli_call_budget.max_calls_per_day.get('anthropic')).toBe(0);
    });

    it('still rejects an unknown provider and a negative value', () => {
        const tmp = make_tmp();
        const badProvider = `${MINIMAL_VALID}cli_call_budget:\n  max_calls_per_day:\n    bogus: 5\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, badProvider))).toThrow(/unknown/);
        const badValue = `${MINIMAL_VALID}cli_call_budget:\n  max_calls_per_day:\n    anthropic: -1\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, badValue))).toThrow(/non-negative integer/);
    });
});

// === road-to-council-quota-accounting-truth Phase 1 — one cap source ===
//
// The gate (`build_members`) and the report (`cmd_quota`) used to resolve the
// per-provider daily cap from two different files. `build_members` additionally
// accepts BOTH the synthesized config block and a RAW `.ai-council.yml` dict, and
// in the raw case a commented-out `cli_call_budget:` left it with an empty map
// whose per-member lookup fell back to `null` — which `CliClient.ask()` reads as
// "uncapped" and skips the gate for, while `_recordCallQuietly()` keeps booking
// into the shared counter. Live consequence, measured before the fix: the shared
// bucket stood at anthropic 72, gemini 63, openai 99 against a REPORTED cap of
// 50 that nothing was applying.
//
// `resolve_cli_call_caps` is the single authority both sides now call. These
// tests pin the property that makes the divergence unreachable rather than
// merely absent.
describe('resolve_cli_call_caps — the single cap authority', () => {
    const PROVIDERS = ['anthropic', 'openai', 'gemini', 'xai', 'perplexity'] as const;

    it('an absent block yields the DEFAULTS, never uncapped', () => {
        // The raw-dict case that produced the live overrun. `undefined`, `{}`,
        // and a non-dict must all land on the same guarded state — omission is
        // not a way to switch the cap off.
        for (const raw of [undefined, null, {}, 'nonsense', 42]) {
            const caps = cfg.resolve_cli_call_caps(raw);
            for (const p of PROVIDERS) {
                expect(caps[p], `${p} for raw=${JSON.stringify(raw)}`).toBe(
                    cfg.DEFAULT_CLI_CALLS_PER_DAY,
                );
            }
        }
    });

    it('an explicit entry overrides just that provider', () => {
        const caps = cfg.resolve_cli_call_caps({ anthropic: 5 });
        expect(caps['anthropic']).toBe(5);
        expect(caps['openai']).toBe(cfg.DEFAULT_CLI_CALLS_PER_DAY);
    });

    it('an explicit 0 is honoured, not read as "use the default"', () => {
        expect(cfg.resolve_cli_call_caps({ anthropic: 0 })['anthropic']).toBe(0);
    });

    it('is lenient where the strict builder throws — a bad entry never blanks the report', () => {
        // Validation belongs to `_build_cli_call_budget`, which runs first on
        // every real config load. This resolver must still return a usable map
        // for the providers that ARE valid, so a malformed neighbour cannot take
        // the quota report down with it.
        const caps = cfg.resolve_cli_call_caps({
            bogus: 5,
            anthropic: -1,
            openai: 1.5,
            gemini: true,
            xai: 7,
        });
        expect(caps['xai']).toBe(7);
        expect(caps['anthropic']).toBe(cfg.DEFAULT_CLI_CALLS_PER_DAY);
        expect(caps['openai']).toBe(cfg.DEFAULT_CLI_CALLS_PER_DAY);
        expect(caps['gemini']).toBe(cfg.DEFAULT_CLI_CALLS_PER_DAY);
        expect(caps).not.toHaveProperty('bogus');
    });

    it('agrees with the synthesized config for the same YAML — gate and report cannot diverge', () => {
        // The regression this whole phase exists for: resolve the RAW mapping the
        // way `build_members` sees it, and the SYNTHESIZED map the strict builder
        // produces, then assert they describe the same caps. A future edit that
        // reintroduces a second resolution path fails here.
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}cli_call_budget:\n  max_calls_per_day:\n    anthropic: 5\n    openai: 0\n`;
        const synthesized = cfg.load_council_config(write_yaml(tmp, payload))
            .cli_call_budget.max_calls_per_day;
        const raw = cfg.resolve_cli_call_caps({ anthropic: 5, openai: 0 });

        for (const p of PROVIDERS) {
            expect(raw[p], `provider ${p}`).toBe(synthesized.get(p));
        }
    });

    it('agrees with the synthesized config when the block is absent entirely', () => {
        const tmp = make_tmp();
        const synthesized = cfg.load_council_config(write_yaml(tmp, MINIMAL_VALID))
            .cli_call_budget.max_calls_per_day;
        const raw = cfg.resolve_cli_call_caps(undefined);

        for (const p of PROVIDERS) {
            expect(raw[p], `provider ${p}`).toBe(synthesized.get(p));
        }
    });
});

// === the fallback block the strict loader does not model ====================
//
// `ai_council.fallback.api_on_quota` is read leniently off the raw settings
// dict by `council_cli.ts::build_members`, not through this loader's typed
// model. That is only safe if the strict loader TOLERATES the block — a
// consumer sets one key and every command that loads the file must still
// work. The loader rejects unknown keys in exactly two places
// (`members.<name>` and `cli_call_budget.max_calls_per_day.<provider>`) and
// nowhere at the top level, so it does. This pins that, because the leniency
// is load-bearing and invisible: nothing else in the tree would fail if a
// future top-level allowlist were added.
// === `fallback` is MODELLED, and it has to be =============================
//
// `council_cli.ts::load_settings` does not hand `build_members` the config
// file — it hands it a block SYNTHESIZED from `CouncilConfig`. So a key this
// loader does not model cannot reach the runtime, whatever the operator wrote.
// That defect shipped twice already (`quorum`, `quorum_min_present`, both
// commented at the synthesizer) and a third time for this key: the contract
// section, the template and the tests all described a switch production could
// not flip. These tests pin the model, not just the tolerance.
describe('config — fallback.api_on_quota', () => {
    it('defaults to false when the block is absent — the only spend-safe default', () => {
        const tmp = make_tmp();
        const c = cfg.load_council_config(write_yaml(tmp, MINIMAL_VALID));
        expect(c.fallback.api_on_quota).toBe(false);
    });

    it('true is honoured', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}\nfallback:\n  api_on_quota: true\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.fallback.api_on_quota).toBe(true);
    });

    it('the block does not disturb any other modelled field', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}\nfallback:\n  api_on_quota: true\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.enabled).toBe(true);
        expect(c.defaults.mode).toBe('auto');
        expect(c.members.get('anthropic')?.model).toBe('claude-x');
    });

    it('a non-boolean VALUE is rejected — an operator authorising spend gets an error, not a silent no', () => {
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}\nfallback:\n  api_on_quota: "yes"\n`;
        expect(() => cfg.load_council_config(write_yaml(tmp, payload))).toThrow(
            /fallback\.api_on_quota/,
        );
    });

    it('a malformed BLOCK reads as off rather than refusing the whole file', () => {
        // Asymmetric on purpose: the key exists to WITHHOLD spend, so a
        // garbled container degrading to "off" is safe, while a garbled value
        // is an instruction nobody should guess at.
        const tmp = make_tmp();
        const payload = `${MINIMAL_VALID}\nfallback: "yes"\n`;
        const c = cfg.load_council_config(write_yaml(tmp, payload));
        expect(c.fallback.api_on_quota).toBe(false);
    });
});

// === the SHIPPED template must survive the real loader ======================
//
// Nothing asserted this before 2026-08-15: the template was referenced by an
// allowlist and a path check, and read by neither. So a template edit could
// ship a file the loader rejects, and the first reader to find out would be a
// consumer seeding a fresh config. This is the cheapest possible guard for it —
// one real `load_council_config` call against the real file.
describe('config — the shipped .ai-council.yml.example', () => {
    const TEMPLATE = path.join(_REPO_ROOT, 'agents', 'templates', '.ai-council.yml.example');

    it('loads through the real loader without hand-editing', () => {
        expect(fs.existsSync(TEMPLATE)).toBe(true);
        expect(() => cfg.load_council_config(TEMPLATE)).not.toThrow();
    });

    it('pins no openai model id — every id this package shipped is refused by a subscription account', () => {
        const c = cfg.load_council_config(TEMPLATE);
        const openai = c.members.get('openai');
        expect(openai).toBeDefined();
        // The assertion is on the SENTINEL, not merely "not gpt-4o": a future
        // edit that swaps one dead pin for another would pass the negative form
        // and reproduce the exact defect this replaced.
        expect(openai?.model).toBe(OPENAI_CLI_VENDOR_DEFAULT);
        // And it must be one the deny-list has never recorded as refused.
        expect(CODEX_MEASURED_UNSERVABLE.has(openai?.model ?? '')).toBe(false);
    });

    it('the vendor-default sentinel is exempt from ladder membership, a real pin is not', () => {
        const base = `enabled: true\ndefaults:\n  mode: api\ncost_budget:\n  max_total_usd: 20.0\nmembers:\n  anthropic:\n    enabled: true\n    api_key_ref: env:ANTHROPIC_KEY\n`;
        const withAuto = `${base}    model: ${OPENAI_CLI_VENDOR_DEFAULT}\n    model_ladder:\n      - claude-haiku-4-5\n`;
        expect(() => cfg.load_council_config(write_yaml(make_tmp(), withAuto))).not.toThrow();

        const withDeadPin = `${base}    model: claude-not-on-the-ladder\n    model_ladder:\n      - claude-haiku-4-5\n`;
        expect(() => cfg.load_council_config(write_yaml(make_tmp(), withDeadPin))).toThrow(
            /model_ladder must include the active/,
        );
    });
});
