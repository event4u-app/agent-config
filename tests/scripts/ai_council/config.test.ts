
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as cfg from '../../../src/scripts/ai_council/config';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

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
        expect(c.defaults.mode).toBe('api');
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
        expect(c.members.get('anthropic')!.mode).toBe('api');
        // openai inherits defaults.mode (manual) → no api_key_ref required.
        expect(c.members.get('openai')!.mode).toBeNull();
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

    it('unknown default mode is rejected', () => {
        const tmp = make_tmp();
        const p = write_yaml(tmp, 'enabled: false\ndefaults:\n  mode: bogus\n');
        expect(() => cfg.load_council_config(p)).toThrow(/defaults\.mode/);
    });

    it('unknown member mode is rejected', () => {
        const tmp = make_tmp();
        const p = write_yaml(
            tmp,
            'enabled: false\nmembers:\n  anthropic:\n    enabled: false\n    mode: weird\n',
        );
        expect(() => cfg.load_council_config(p)).toThrow(/members\.anthropic\.mode/);
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

    it('enabled api-mode member without api_key_ref fails', () => {
        const tmp = make_tmp();
        const p = write_yaml(
            tmp,
            'enabled: false\nmembers:\n  anthropic:\n    enabled: true\n    model: m\n',
        );
        expect(() => cfg.load_council_config(p)).toThrow(/api_key_ref/);
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
function ts_jsonable(c: cfg.CouncilConfig): Record<string, unknown> {
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

const FULL_FIXTURE = `enabled: true
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
