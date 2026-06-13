#!/usr/bin/env tsx
/** Structural smoke-test for the README Quickstart path.
 *
 * TypeScript twin of `src/scripts/smoke_quickstart.py` (ADR-090, Phase 8 /
 * Wave 8h). Mirrors the Python CLI contract EXACTLY — no flags, exit codes
 * (0 green, 1 one or more checks failed, 2 setup error), byte-identical
 * stdout/stderr (`::error::…` GitHub-annotation lines, the ✅/❌ summary). No
 * behaviour changes.
 *
 * Verifies the 3-step Quickstart from a fresh-project perspective:
 *
 *   1. `scripts/install.py --project <tmpdir>` produces a usable
 *      `.agent-settings.yml` with the documented default `rule_loading_tier`.
 *   2. The decision_engine block (P2.x of road-to-productization) parses
 *      cleanly through the same engine parser the runtime uses.
 *   3. The work-engine state-file format (`agents/runtime/state/<id>.json`) is
 *      emit-ready — schema for `decision_result` matches the contract.
 *
 * What it does NOT do:
 *   - Invoke a real LLM agent (CI doesn't run a model). The end-to-end
 *     `/onboard → /work → decision_result` chain still requires the host
 *     agent. This smoke test asserts the *mechanics* the agent depends
 *     on, so a Quickstart break is caught before the agent ever runs.
 *
 * Cross-batch dependency: Step 1 runs the still-Python installer
 * (`install.py`) via `python3` exactly as the Python original runs it via
 * `sys.executable`; Step 3 imports the still-Python `decision_engine` module
 * (under `templates/scripts/`, no TS twin) and so runs that check through a
 * `python3` shim that reproduces the Python logic and message surface. A
 * `.ts` cannot import a `.py`, and porting the work-engine scoring tree is
 * out of this wave's scope.
 *
 * Exit codes: 0 = green; 1 = one or more checks failed; 2 = setup error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

// Python: ROOT = Path(__file__).resolve().parent.parent.parent
const ROOT = path.resolve(_HERE, '..', '..', '..');
const INSTALLER = path.join(ROOT, 'src', 'scripts', 'install.py');
const TEMPLATE = path.join(ROOT, 'src', 'config', 'agent-settings.template.yml');

const EXPECTED_DEFAULT_PROFILE = 'balanced';

function _fail(msg: string): number {
    process.stderr.write(`::error::${msg}\n`);
    return 1;
}

/** Step 1 — run installer against a fresh tmpdir. */
function _checkInstallerRuns(tmpdir: string): [number, string | null] {
    const cmd = [
        INSTALLER,
        '--project',
        tmpdir,
        '--package',
        ROOT,
        '--skip-bridges',
    ];
    // ADR-020: --project is reserved for maintainers; CI is a maintainer context.
    const env = { ...process.env, AGENT_CONFIG_DEV_MODE: '1' };
    const result = spawnSync('python3', cmd, {
        encoding: 'utf-8',
        timeout: 60000,
        env,
        maxBuffer: 256 * 1024 * 1024,
    });
    if (result.error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
        return [_fail('installer timed out after 60s'), null];
    }
    if (result.status !== 0) {
        return [
            _fail(
                `installer exited ${result.status}\nstdout:\n${result.stdout ?? ''}\nstderr:\n${result.stderr ?? ''}`,
            ),
            null,
        ];
    }
    // ADR-038: installer writes the canonical settings file under agents/settings/.
    const settings = path.join(tmpdir, 'agents', 'settings', '.agent-settings.yml');
    if (!fs.existsSync(settings)) {
        return [_fail('agents/settings/.agent-settings.yml not written by installer'), null];
    }
    return [0, settings];
}

/** Step 2 — assert default rule_loading_tier matches the contract. */
function _checkDefaultProfile(settings: string): number {
    const parsed: unknown = parseYaml(fs.readFileSync(settings, 'utf-8'), { version: '1.1' });
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return _fail(`${path.basename(settings)}: top-level is not a YAML mapping`);
    }
    const profile = (parsed as Record<string, unknown>).rule_loading_tier;
    if (profile !== EXPECTED_DEFAULT_PROFILE) {
        return _fail(
            `rule_loading_tier drift: docs/contracts/rule-loading-tier-defaults.md ` +
                `declares '${EXPECTED_DEFAULT_PROFILE}', settings has '${_pyRepr(profile)}'`,
        );
    }
    return 0;
}

/**
 * Step 3 — decision_engine block parses through the engine parser.
 *
 * The parser lives in the still-Python `work_engine.scoring.decision_engine`
 * module; run the check through a `python3` shim that reproduces the Python
 * `_check_decision_engine_block` logic and emits the failure reason (if any)
 * on stdout so the TS `_fail` wrapper produces a byte-identical `::error::`.
 */
function _checkDecisionEngineBlock(settings: string): number {
    const shim = `
import sys
from pathlib import Path
ROOT = Path(${JSON.stringify(ROOT)})
SETTINGS = Path(${JSON.stringify(settings)})
sys.path.insert(0, str(ROOT / "src" / "scripts"))
from _lib.agent_src import resolve_logical
template_scripts = resolve_logical("templates/scripts") or (
    ROOT / ".agent-src.uncondensed" / "templates" / "scripts"
)
sys.path.insert(0, str(template_scripts))
try:
    from work_engine.scoring.decision_engine import (
        DecisionEngineSettings,
        parse as parse_decision_engine,
    )
except ImportError as exc:
    print(f"decision_engine module not importable: {exc}")
    sys.exit(1)
import yaml
parsed = yaml.safe_load(SETTINGS.read_text(encoding="utf-8"))
block = parsed.get("decision_engine") if isinstance(parsed, dict) else None
try:
    settings_obj = parse_decision_engine(block)
except Exception as exc:
    print(f"decision_engine block rejected by parser: {exc}")
    sys.exit(1)
if not isinstance(settings_obj, DecisionEngineSettings):
    print("parser returned non-DecisionEngineSettings instance")
    sys.exit(1)
sys.exit(0)
`;
    const result = spawnSync('python3', ['-c', shim], {
        encoding: 'utf-8',
        cwd: ROOT,
        maxBuffer: 256 * 1024 * 1024,
    });
    if (result.status === 0) {
        return 0;
    }
    const reason = (result.stdout ?? '').replace(/\n+$/, '').split('\n').pop() ?? '';
    return _fail(reason);
}

/** Python repr() of a scalar value as embedded by `{profile!r}`. */
function _pyRepr(value: unknown): string {
    if (typeof value === 'string') {
        const hasSingle = value.includes("'");
        const hasDouble = value.includes('"');
        const quote = hasSingle && !hasDouble ? '"' : "'";
        let out = quote;
        for (const ch of value) {
            if (ch === '\\') {
                out += '\\\\';
            } else if (ch === quote) {
                out += '\\' + quote;
            } else if (ch === '\n') {
                out += '\\n';
            } else if (ch === '\r') {
                out += '\\r';
            } else if (ch === '\t') {
                out += '\\t';
            } else {
                out += ch;
            }
        }
        return out + quote;
    }
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    return String(value);
}

export function main(): number {
    if (!fs.existsSync(INSTALLER)) {
        process.stderr.write(`::error::installer not found at ${INSTALLER}\n`);
        return 2;
    }
    if (!fs.existsSync(TEMPLATE)) {
        process.stderr.write(`::error::template not found at ${TEMPLATE}\n`);
        return 2;
    }

    let failures = 0;
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-quickstart-'));
    try {
        const [rc, settings] = _checkInstallerRuns(tmpdir);
        failures += rc;
        if (settings !== null) {
            failures += _checkDefaultProfile(settings);
            failures += _checkDecisionEngineBlock(settings);
        }
    } finally {
        fs.rmSync(tmpdir, { recursive: true, force: true });
    }

    if (failures) {
        process.stderr.write(`\n❌  smoke-quickstart: ${failures} check(s) failed\n`);
        return 1;
    }
    process.stdout.write('✅  smoke-quickstart: install → settings → decision_engine green\n');
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
