/**
 * Production-port test for `src/scripts/sync_agent_settings.ts`.
 *
 * Mirrors `tests/test_sync_agent_settings.py` 1:1 (creation, preservation,
 * idempotency, --check / --dry-run, healer, profile override, malformed
 * input, list values) by driving `main(argv)` in-process, and adds golden
 * differential parity that runs `python3 sync_agent_settings.py` vs
 * `tsx sync_agent_settings.ts` on identical invocations, asserting
 * byte-identical stdout + stderr + exit code.
 *
 * The script WRITES — every fixture lives in an mkdtemp scratch dir, so
 * there is no repo file to snapshot/restore and zero git drift. The CI
 * invocation (`--quiet`) plus `--check` / `--dry-run` are exercised
 * against those scratch dirs.
 *
 * No behaviour changes vs. the Python original — latent bugs replicated.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../src/scripts/sync_agent_settings.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'sync_agent_settings.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'sync_agent_settings.ts');

const MINIMAL_TEMPLATE = `# Header
rule_loading_tier: __RULE_LOADING_TIER__

# --- Personal preferences ---
personal:
  # IDE preference
  ide: ""

  # Name
  user_name: ""

# --- Chat history ---
chat_history:
  enabled: true
  frequency: __CHAT_HISTORY_FREQUENCY__
  max_size_kb: __CHAT_HISTORY_MAX_SIZE_KB__

# --- Onboarding ---
onboarding:
  onboarded: false
`;

const MINIMAL_INI = `rule_loading_tier=minimal
chat_history_frequency=per_turn
chat_history_max_size_kb=128
chat_history_on_overflow=rotate
`;

const NESTED_TEMPLATE = `rule_loading_tier: __RULE_LOADING_TIER__

commands:
  suggestion:
    enabled: true
    confidence_floor: 0.6
    cooldown_seconds: 600
    max_options: 4
    blocklist: []
`;

// --- yaml parse helper (read-back asserts; YAML 1.1 like PyYAML safe_load) ---
import { parse as parseYaml } from 'yaml';
function yamlLoad(text: string): Record<string, unknown> {
  return parseYaml(text, { version: '1.1' }) as Record<string, unknown>;
}

// --- workspace scaffolding ------------------------------------------------

let workspace: string;

function makeWorkspace(template = MINIMAL_TEMPLATE, ini = MINIMAL_INI): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-'));
  fs.mkdirSync(path.join(ws, 'config', 'profiles'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'config', 'agent-settings.template.yml'), template, 'utf-8');
  fs.writeFileSync(path.join(ws, 'config', 'profiles', 'minimal.ini'), ini, 'utf-8');
  return ws;
}

function run(ws: string, extra: string[] = []): number {
  const args = [
    '--path',
    path.join(ws, '.agent-settings.yml'),
    '--template',
    path.join(ws, 'config', 'agent-settings.template.yml'),
    '--profile-dir',
    path.join(ws, 'config', 'profiles'),
    '--quiet',
  ];
  return main([...args, ...extra]);
}

afterEach(() => {
  if (workspace && fs.existsSync(workspace)) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

// =====================================================================
// 1:1 port — minimal workspace
// =====================================================================

describe('sync_agent_settings — minimal workspace', () => {
  beforeEach(() => {
    workspace = makeWorkspace();
  });

  it('creates file from template when missing', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    expect(fs.existsSync(target)).toBe(false);
    expect(run(workspace)).toBe(0);
    const data = yamlLoad(fs.readFileSync(target, 'utf-8'));
    expect(data['rule_loading_tier']).toBe('minimal');
    expect((data['chat_history'] as Record<string, unknown>)['frequency']).toBe('per_turn');
    expect((data['chat_history'] as Record<string, unknown>)['max_size_kb']).toBe(128);
    expect((data['onboarding'] as Record<string, unknown>)['onboarded']).toBe(false);
  });

  it('preserves user values and adds missing sections', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(
      target,
      'rule_loading_tier: minimal\npersonal:\n  ide: phpstorm\n  user_name: Matze\n',
      'utf-8',
    );
    expect(run(workspace)).toBe(0);
    const data = yamlLoad(fs.readFileSync(target, 'utf-8'));
    const personal = data['personal'] as Record<string, unknown>;
    expect(personal['ide']).toBe('phpstorm');
    expect(personal['user_name']).toBe('Matze');
    expect((data['chat_history'] as Record<string, unknown>)['frequency']).toBe('per_turn');
    expect((data['onboarding'] as Record<string, unknown>)['onboarded']).toBe(false);
  });

  it('idempotent second run is a no-op', () => {
    expect(run(workspace)).toBe(0);
    const target = path.join(workspace, '.agent-settings.yml');
    const first = fs.readFileSync(target, 'utf-8');
    expect(run(workspace)).toBe(0);
    const second = fs.readFileSync(target, 'utf-8');
    expect(first).toBe(second);
  });

  it('--check exits 2 on drift, no write', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(target, 'rule_loading_tier: minimal\n', 'utf-8');
    expect(run(workspace, ['--check'])).toBe(2);
    expect(fs.readFileSync(target, 'utf-8')).toBe('rule_loading_tier: minimal\n');
  });

  it('--check exits 0 when in sync', () => {
    expect(run(workspace)).toBe(0);
    expect(run(workspace, ['--check'])).toBe(0);
  });

  it('--dry-run does not write', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(target, 'rule_loading_tier: minimal\n', 'utf-8');
    const before = fs.readFileSync(target, 'utf-8');
    expect(run(workspace, ['--dry-run'])).toBe(0);
    expect(fs.readFileSync(target, 'utf-8')).toBe(before);
  });

  it('unknown user keys preserved verbatim', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(
      target,
      'rule_loading_tier: minimal\nlegacy_thing:\n  flag: custom_value\n',
      'utf-8',
    );
    expect(run(workspace)).toBe(0);
    const body = fs.readFileSync(target, 'utf-8');
    expect(body).toContain('legacy_thing:\n  flag: custom_value\n');
    expect(body).not.toContain('_user:');
  });

  it('user block round-trip is idempotent', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(
      target,
      'rule_loading_tier: minimal\nlegacy_thing:\n  flag: custom_value\n  nested:\n    deep: 42\n',
      'utf-8',
    );
    expect(run(workspace)).toBe(0);
    const snapshots = [fs.readFileSync(target, 'utf-8')];
    for (let i = 0; i < 5; i++) {
      expect(run(workspace)).toBe(0);
      snapshots.push(fs.readFileSync(target, 'utf-8'));
    }
    for (const s of snapshots.slice(1)) {
      expect(s).toBe(snapshots[1]);
    }
    const last = snapshots[snapshots.length - 1] as string;
    expect(last).not.toContain('_user._user.');
    expect(last).toContain('legacy_thing:\n  flag: custom_value\n  nested:\n    deep: 42\n');
  });

  it('repairs legacy corruption', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    const corruptedKey = '_user.'.repeat(50) + 'legacy_thing.flag';
    fs.writeFileSync(
      target,
      `rule_loading_tier: minimal\n_user:\n  ${corruptedKey}: custom_value\n`,
      'utf-8',
    );
    expect(run(workspace)).toBe(0);
    const body = fs.readFileSync(target, 'utf-8');
    expect(body).not.toContain('_user._user.');
    expect(body).toContain('  legacy_thing.flag: custom_value');
    const first = body;
    expect(run(workspace)).toBe(0);
    expect(fs.readFileSync(target, 'utf-8')).toBe(first);
  });

  it('bare identifier not requoted', () => {
    expect(run(workspace)).toBe(0);
    const body = fs.readFileSync(path.join(workspace, '.agent-settings.yml'), 'utf-8');
    expect(body).toContain('frequency: per_turn\n');
    expect(body).not.toContain('frequency: "per_turn"');
  });

  it('--profile balanced overrides inferred tier', () => {
    fs.writeFileSync(
      path.join(workspace, 'config', 'profiles', 'balanced.ini'),
      'rule_loading_tier=balanced\nchat_history_frequency=per_phase\nchat_history_max_size_kb=256\nchat_history_on_overflow=rotate\n',
      'utf-8',
    );
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(target, 'rule_loading_tier: minimal\n', 'utf-8');
    expect(run(workspace, ['--profile', 'balanced'])).toBe(0);
    const body = fs.readFileSync(target, 'utf-8');
    expect(body).toContain('rule_loading_tier: minimal\n');
    const data = yamlLoad(body);
    const ch = data['chat_history'] as Record<string, unknown>;
    expect(ch['frequency']).toBe('per_phase');
    expect(ch['max_size_kb']).toBe(256);
  });

  it('malformed user yaml exits 2 with message', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(target, 'section:\n\tchild: value\n', 'utf-8');
    const errChunks: string[] = [];
    const origErr = process.stderr.write.bind(process.stderr);
    // Capture stderr written by main().
    (process.stderr.write as unknown) = (chunk: string | Uint8Array): boolean => {
      errChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
      return true;
    };
    let rc: number;
    try {
      rc = run(workspace);
    } finally {
      (process.stderr.write as unknown) = origErr;
    }
    expect(rc).toBe(2);
    const err = errChunks.join('');
    expect(err).toContain('error:');
    expect(err).toContain('.agent-settings.yml');
    expect(fs.readFileSync(target, 'utf-8')).toBe('section:\n\tchild: value\n');
  });
});

// =====================================================================
// 1:1 port — nested (commands.suggestion.*) workspace
// =====================================================================

describe('sync_agent_settings — nested workspace', () => {
  beforeEach(() => {
    workspace = makeWorkspace(NESTED_TEMPLATE, 'rule_loading_tier=minimal\n');
  });

  it('three-level user values preserved (valid YAML, no dict-repr)', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(
      target,
      'rule_loading_tier: minimal\ncommands:\n  suggestion:\n    enabled: false\n    confidence_floor: 0.8\n    cooldown_seconds: 300\n    max_options: 2\n    blocklist: []\n',
      'utf-8',
    );
    expect(run(workspace)).toBe(0);
    const body = fs.readFileSync(target, 'utf-8');
    const data = yamlLoad(body);
    const sug = (data['commands'] as Record<string, unknown>)['suggestion'] as Record<string, unknown>;
    expect(sug['enabled']).toBe(false);
    expect(sug['confidence_floor']).toBe(0.8);
    expect(sug['cooldown_seconds']).toBe(300);
    expect(sug['max_options']).toBe(2);
    expect(body).not.toContain('suggestion: "{');
  });

  it('three-level idempotent', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(
      target,
      'rule_loading_tier: minimal\ncommands:\n  suggestion:\n    enabled: false\n    confidence_floor: 0.8\n    cooldown_seconds: 300\n    max_options: 2\n    blocklist: []\n',
      'utf-8',
    );
    expect(run(workspace)).toBe(0);
    const first = fs.readFileSync(target, 'utf-8');
    expect(run(workspace)).toBe(0);
    expect(fs.readFileSync(target, 'utf-8')).toBe(first);
  });

  it('list values round-trip (flow-style preserved)', () => {
    const target = path.join(workspace, '.agent-settings.yml');
    fs.writeFileSync(
      target,
      'rule_loading_tier: minimal\ncommands:\n  suggestion:\n    enabled: true\n    confidence_floor: 0.6\n    cooldown_seconds: 600\n    max_options: 4\n    blocklist: ["/refine-ticket", "/work"]\n',
      'utf-8',
    );
    expect(run(workspace)).toBe(0);
    const body = fs.readFileSync(target, 'utf-8');
    const data = yamlLoad(body);
    const sug = (data['commands'] as Record<string, unknown>)['suggestion'] as Record<string, unknown>;
    expect(sug['blocklist']).toEqual(['/refine-ticket', '/work']);
    expect(body).not.toContain('blocklist: "[\'');
  });
});

// =====================================================================
// Golden differential parity — python3 vs tsx, byte-identical
// =====================================================================

function pythonAvailable(): boolean {
  try {
    execFileSync('python3', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const HAS_PYTHON = pythonAvailable();

interface RunResult {
  stdout: string;
  stderr: string;
  exit: number;
}

function spawnCli(cmd: 'python3' | 'tsx', script: string, args: string[]): RunResult {
  try {
    const stdout = execFileSync(cmd, [script, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exit: 0 };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      stdout: e.stdout ? e.stdout.toString() : '',
      stderr: e.stderr ? e.stderr.toString() : '',
      exit: e.status ?? 1,
    };
  }
}

describe.skipIf(!HAS_PYTHON)('golden parity — python3 vs tsx (byte-identical stdout/stderr/exit)', () => {
  let gWorkspace: string;
  // Use absolute --template / --profile-dir / --path so cwd is irrelevant
  // and the comparison is deterministic across both runtimes.
  function gArgs(ws: string, target: string, extra: string[] = []): string[] {
    return [
      '--path',
      target,
      '--template',
      path.join(ws, 'config', 'agent-settings.template.yml'),
      '--profile-dir',
      path.join(ws, 'config', 'profiles'),
      ...extra,
    ];
  }

  // Build a workspace template/profile pair to compare against.
  function freshWs(): string {
    return makeWorkspace();
  }

  afterEach(() => {
    if (gWorkspace && fs.existsSync(gWorkspace)) {
      fs.rmSync(gWorkspace, { recursive: true, force: true });
    }
  });

  it('write path (create from template): identical output + identical written bytes', () => {
    gWorkspace = freshWs();
    const pyTarget = path.join(gWorkspace, 'py.yml');
    const tsTarget = path.join(gWorkspace, 'ts.yml');
    const py = spawnCli('python3', PY_SCRIPT, gArgs(gWorkspace, pyTarget));
    const ts = spawnCli('tsx', TS_SCRIPT, gArgs(gWorkspace, tsTarget));
    // stdout differs only by the embedded target path → normalise it out.
    const normPy = py.stdout.split(pyTarget).join('<TARGET>');
    const normTs = ts.stdout.split(tsTarget).join('<TARGET>');
    expect(normTs).toBe(normPy);
    expect(ts.stderr).toBe(py.stderr);
    expect(ts.exit).toBe(py.exit);
    // The written file bytes must be byte-identical.
    expect(fs.readFileSync(tsTarget, 'utf-8')).toBe(fs.readFileSync(pyTarget, 'utf-8'));
  });

  it('--quiet write path: identical (silent) output and written bytes', () => {
    gWorkspace = freshWs();
    const pyTarget = path.join(gWorkspace, 'py.yml');
    const tsTarget = path.join(gWorkspace, 'ts.yml');
    const py = spawnCli('python3', PY_SCRIPT, gArgs(gWorkspace, pyTarget, ['--quiet']));
    const ts = spawnCli('tsx', TS_SCRIPT, gArgs(gWorkspace, tsTarget, ['--quiet']));
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
    expect(ts.exit).toBe(py.exit);
    expect(fs.readFileSync(tsTarget, 'utf-8')).toBe(fs.readFileSync(pyTarget, 'utf-8'));
  });

  it('--check on drift: identical diff stdout, stderr marker, exit 2', () => {
    gWorkspace = freshWs();
    const drift = 'rule_loading_tier: minimal\n';
    const pyTarget = path.join(gWorkspace, 'py.yml');
    const tsTarget = path.join(gWorkspace, 'ts.yml');
    fs.writeFileSync(pyTarget, drift, 'utf-8');
    fs.writeFileSync(tsTarget, drift, 'utf-8');
    const py = spawnCli('python3', PY_SCRIPT, gArgs(gWorkspace, pyTarget, ['--check']));
    const ts = spawnCli('tsx', TS_SCRIPT, gArgs(gWorkspace, tsTarget, ['--check']));
    const normPy = (py.stdout + '' + py.stderr).split(pyTarget).join('<TARGET>');
    const normTs = (ts.stdout + '' + ts.stderr).split(tsTarget).join('<TARGET>');
    expect(normTs).toBe(normPy);
    expect(ts.exit).toBe(2);
    expect(py.exit).toBe(2);
    // Neither run should have modified the file.
    expect(fs.readFileSync(tsTarget, 'utf-8')).toBe(drift);
    expect(fs.readFileSync(pyTarget, 'utf-8')).toBe(drift);
  });

  it('--dry-run on drift: identical diff stdout, exit 0, no write', () => {
    gWorkspace = freshWs();
    const drift = 'rule_loading_tier: minimal\npersonal:\n  ide: phpstorm\n';
    const pyTarget = path.join(gWorkspace, 'py.yml');
    const tsTarget = path.join(gWorkspace, 'ts.yml');
    fs.writeFileSync(pyTarget, drift, 'utf-8');
    fs.writeFileSync(tsTarget, drift, 'utf-8');
    const py = spawnCli('python3', PY_SCRIPT, gArgs(gWorkspace, pyTarget, ['--dry-run']));
    const ts = spawnCli('tsx', TS_SCRIPT, gArgs(gWorkspace, tsTarget, ['--dry-run']));
    const normPy = (py.stdout + '' + py.stderr).split(pyTarget).join('<TARGET>');
    const normTs = (ts.stdout + '' + ts.stderr).split(tsTarget).join('<TARGET>');
    expect(normTs).toBe(normPy);
    expect(ts.exit).toBe(0);
    expect(py.exit).toBe(0);
    expect(fs.readFileSync(tsTarget, 'utf-8')).toBe(drift);
    expect(fs.readFileSync(pyTarget, 'utf-8')).toBe(drift);
  });

  it('unsupported profile: identical stderr + exit 2', () => {
    gWorkspace = freshWs();
    const pyTarget = path.join(gWorkspace, 'py.yml');
    const tsTarget = path.join(gWorkspace, 'ts.yml');
    const py = spawnCli('python3', PY_SCRIPT, gArgs(gWorkspace, pyTarget, ['--profile', 'bogus']));
    const ts = spawnCli('tsx', TS_SCRIPT, gArgs(gWorkspace, tsTarget, ['--profile', 'bogus']));
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
    expect(ts.exit).toBe(py.exit);
    expect(ts.exit).toBe(2);
  });

  it('missing template: identical error stderr + exit 2', () => {
    gWorkspace = freshWs();
    const pyTarget = path.join(gWorkspace, 'py.yml');
    const tsTarget = path.join(gWorkspace, 'ts.yml');
    const missing = path.join(gWorkspace, 'nope.yml');
    const baseArgs = (t: string): string[] => [
      '--path',
      t,
      '--template',
      missing,
      '--profile-dir',
      path.join(gWorkspace, 'config', 'profiles'),
    ];
    const py = spawnCli('python3', PY_SCRIPT, baseArgs(pyTarget));
    const ts = spawnCli('tsx', TS_SCRIPT, baseArgs(tsTarget));
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
    expect(ts.exit).toBe(py.exit);
    expect(ts.exit).toBe(2);
  });
});
