#!/usr/bin/env node
// Re-runs the executions the classification ledger cites, from fixtures this
// script writes itself, and prints each command with its exit code and last
// output line. Run with node from anywhere; no arguments.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-exec-'));
const stores = {
    'absent.jsonl': null,
    'all-malformed.jsonl': 'not json\n{also not\n',
    'valid-json-not-usable.jsonl': '{"session":"test","other_key":123}\n{"composite_ms":5}\n',
    'partial.jsonl': 'not json\n{"session":"s1","composite_ms":1000}\n',
    'valid.jsonl': '{"session":"s1","composite_ms":1000}\n',
};
for (const [name, body] of Object.entries(stores)) if (body !== null) fs.writeFileSync(path.join(dir, name), body);

const runs = [
    ...Object.keys(stores).map((name) => ({ row: 'R16.a–d', args: ['src/scripts/check_composite_arming', '--store', path.join(dir, name)], label: `--store ${name}` })),
    { row: 'R16.e', args: ['src/scripts/check_composite_arming', '--self-test'], label: 'check_composite_arming --self-test' },
    { row: 'R2.b', args: ['src/scripts/lint_ticked_unmet_criteria', '--self-test'], label: 'lint_ticked_unmet_criteria --self-test' },
    { row: 'R7.b', args: ['src/scripts/lint_rule_enforcement_declaration', '--self-test'], label: 'lint_rule_enforcement_declaration --self-test' },
    { row: 'R3.b', args: ['src/scripts/check_rule_invariants', '--mutation-selftest'], label: 'check_rule_invariants --mutation-selftest' },
];
for (const r of runs) {
    const res = spawnSync(path.join(ROOT, 'scripts-run'), r.args, { cwd: ROOT, encoding: 'utf8' });
    const lines = `${res.stdout}${res.stderr}`.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    const last = (lines.at(-1) ?? '').replace(dir, '<tmp>').slice(0, 160);
    console.log(`${r.row} | ${r.label} | exit ${String(res.status)} | ${last}`);
}
fs.rmSync(dir, { recursive: true, force: true });
