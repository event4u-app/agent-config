// Tests for src/scripts/ai_council/prompts.ts (py2ts Phase 1).
//
// prompts assembles neutrality system-prompt text (pure string-building).
// Golden parity drives the LIVE Python twin via a `python3 -c` importlib
// direct-file load — the ai_council `__init__` pulls networked clients, so we
// load `prompts.py` straight off disk and register it in sys.modules (the same
// rig confidence_gate.test.ts uses). project_context is imported by prompts;
// we register its module path too so the relative import resolves.
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { ProjectContext } from '../../../src/scripts/ai_council/project_context.js';
import {
    advisor_system_prompt,
    all_modes,
    all_synthesis_modes,
    build_extraction_user_prompt,
    build_peer_review_user_prompt,
    build_scoring_user_prompt,
    handoff_preamble,
    HOST_AGENT_IDENTITY_PATTERNS,
    NEUTRALITY_PREAMBLE,
    peer_review_synthesis_addendum,
    synthesis_template,
    system_prompt_for,
} from '../../../src/scripts/ai_council/prompts.js';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

const PROMPTS_PY = 'src/scripts/ai_council/prompts.py';
const PCTX_PY = 'src/scripts/ai_council/project_context.py';

// Register both modules off disk so prompts.py's
// `from scripts.ai_council.project_context import ProjectContext` resolves
// without importing the package `__init__` (networked clients).
function pyLoadPreamble(): string[] {
    return [
        'import importlib.util, sys, json',
        // project_context first — prompts imports it by package path.
        `_pc_spec = importlib.util.spec_from_file_location("scripts.ai_council.project_context", ${JSON.stringify(PCTX_PY)})`,
        '_pc = importlib.util.module_from_spec(_pc_spec)',
        'sys.modules["scripts.ai_council.project_context"] = _pc',
        '_pc_spec.loader.exec_module(_pc)',
        `_spec = importlib.util.spec_from_file_location("pr", ${JSON.stringify(PROMPTS_PY)})`,
        'pr = importlib.util.module_from_spec(_spec)',
        'sys.modules["pr"] = pr',
        '_spec.loader.exec_module(pr)',
        'PC = _pc.ProjectContext',
    ];
}

function py(snippet: string): string {
    const code = [...pyLoadPreamble(), snippet].join('\n');
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout;
}

// ── Unit tests of the TS surface ─────────────────────────────────────

describe('prompts — constants + mode tables', () => {
    it('NEUTRALITY_PREAMBLE is stripped (no leading/trailing whitespace)', () => {
        expect(NEUTRALITY_PREAMBLE).toBe(NEUTRALITY_PREAMBLE.trim());
        expect(NEUTRALITY_PREAMBLE.startsWith('You are an independent reviewer')).toBe(true);
    });
    it('all_modes returns the 9 sorted mode keys', () => {
        expect(all_modes()).toEqual([
            'analysis',
            'debate',
            'design',
            'diff',
            'files',
            'optimize',
            'pr',
            'prompt',
            'roadmap',
        ]);
    });
    it('all_synthesis_modes returns the 5 sorted lens keys', () => {
        expect(all_synthesis_modes()).toEqual(['analysis', 'default', 'design', 'optimize', 'pr']);
    });
    it('HOST_AGENT_IDENTITY_PATTERNS covers the documented needles', () => {
        expect(HOST_AGENT_IDENTITY_PATTERNS).toContain('augment');
        expect(HOST_AGENT_IDENTITY_PATTERNS).toContain('claude code');
    });
});

describe('prompts — synthesis_template', () => {
    it('null → default decision template', () => {
        expect(synthesis_template(null)).toBe(synthesis_template('default'));
    });
    it('input modes inherit default', () => {
        for (const m of ['prompt', 'roadmap', 'diff', 'files']) {
            expect(synthesis_template(m)).toBe(synthesis_template('default'));
        }
    });
    it('creative lenses return empty string', () => {
        expect(synthesis_template('design')).toBe('');
        expect(synthesis_template('optimize')).toBe('');
    });
    it('unknown mode raises with sorted-union expected list', () => {
        expect(() => synthesis_template('bogus')).toThrow(/Unknown synthesis mode 'bogus'/);
        expect(() => synthesis_template('bogus')).toThrow(
            /Expected one of: \['analysis', 'default', 'design', 'diff', 'files', 'optimize', 'pr', 'prompt', 'roadmap'\]/,
        );
    });
});

describe('prompts — system_prompt_for', () => {
    it('unknown mode raises with sorted expected list', () => {
        expect(() => system_prompt_for('bogus')).toThrow(/Unknown council mode 'bogus'/);
    });
    it('bare call = NEUTRALITY_PREAMBLE + addendum', () => {
        const out = system_prompt_for('prompt');
        expect(out.startsWith(NEUTRALITY_PREAMBLE)).toBe(true);
    });
    it('project + ask prepend the handoff preamble', () => {
        const out = system_prompt_for('diff', {
            project: new ProjectContext('Demo', 'PHP 8.3', 'A purpose.'),
            original_ask: 'Should I ship?',
        });
        expect(out).toContain('Project: Demo');
        expect(out).toContain('> Should I ship?');
    });
});

describe('prompts — handoff_preamble neutrality', () => {
    it('strips host-identity lines from project + ask', () => {
        const project = new ProjectContext('Built with Augment', 'PHP', 'Uses Claude Code here.');
        const out = handoff_preamble(project, 'Ask via Cursor IDE\nSecond line ok');
        expect(out.toLowerCase()).not.toContain('augment');
        expect(out.toLowerCase()).not.toContain('claude code');
        expect(out.toLowerCase()).not.toContain('cursor ide');
        expect(out).toContain('Second line ok');
    });
    it('null project + empty ask → bare preamble', () => {
        expect(handoff_preamble(null, '')).toBe(NEUTRALITY_PREAMBLE);
    });
});

describe('prompts — advisor + builder prompts', () => {
    it('advisor_system_prompt appends persona body', () => {
        const out = advisor_system_prompt('  Persona body.  ');
        expect(out.endsWith('Persona body.')).toBe(true);
    });
    it('advisor_system_prompt raises on empty persona', () => {
        expect(() => advisor_system_prompt('   ')).toThrow(/persona_text is empty/);
    });
    it('build_scoring_user_prompt renders labels', () => {
        const out = build_scoring_user_prompt(
            new Map([
                ['Finding-A', 'first'],
                ['Finding-B', 'second'],
            ]),
        );
        expect(out).toContain('### Finding-A\n\nfirst');
        expect(out).toContain('### Finding-B\n\nsecond');
    });
    it('build_peer_review_user_prompt renders labels', () => {
        const out = build_peer_review_user_prompt(new Map([['Response-A', 'body']]));
        expect(out).toContain('### Response-A\n\nbody');
    });
    it('build_extraction_user_prompt strips host identity', () => {
        const out = build_extraction_user_prompt('line one with Windsurf\nline two');
        expect(out.toLowerCase()).not.toContain('windsurf');
        expect(out).toContain('line two');
    });
    it('peer_review_synthesis_addendum starts with a leading newline', () => {
        expect(peer_review_synthesis_addendum().startsWith('\n### Peer-Review-Surfaced')).toBe(true);
    });
});

// ── Golden parity vs the CPython twin ────────────────────────────────

describe.runIf(py3)('prompts — golden parity vs CPython twin', () => {
    const modes = ['prompt', 'roadmap', 'diff', 'files', 'pr', 'design', 'optimize', 'analysis', 'debate'];
    const synthKeys = [
        'default',
        'pr',
        'analysis',
        'design',
        'optimize',
        'prompt',
        'roadmap',
        'diff',
        'files',
    ];

    it('all_modes + all_synthesis_modes match', () => {
        const out = py(
            'print(json.dumps([pr.all_modes(), pr.all_synthesis_modes()]))',
        ).trim();
        expect([all_modes(), all_synthesis_modes()]).toEqual(JSON.parse(out));
    });

    it.each(modes)('system_prompt_for(%s) bare matches', (mode) => {
        const out = py(
            `print(json.dumps(pr.system_prompt_for(${JSON.stringify(mode)})))`,
        ).trim();
        expect(system_prompt_for(mode)).toEqual(JSON.parse(out));
    });

    it.each(modes)('system_prompt_for(%s) with project+ask matches', (mode) => {
        const expected = py(
            `proj = PC(name="Demo App", stack="PHP 8.3 \\u00b7 Laravel", repo_purpose="It does things. Carefully.")\n` +
                `print(json.dumps(pr.system_prompt_for(${JSON.stringify(mode)}, project=proj, original_ask="Line A with Augment\\nLine B kept")))`,
        ).trim();
        const got = system_prompt_for(mode, {
            project: new ProjectContext('Demo App', 'PHP 8.3 · Laravel', 'It does things. Carefully.'),
            original_ask: 'Line A with Augment\nLine B kept',
        });
        expect(got).toEqual(JSON.parse(expected));
    });

    it.each(synthKeys)('synthesis_template(%s) matches', (key) => {
        const expected = py(
            `print(json.dumps(pr.synthesis_template(${JSON.stringify(key)})))`,
        ).trim();
        expect(synthesis_template(key)).toEqual(JSON.parse(expected));
    });

    it('synthesis_template(None) matches', () => {
        const expected = py('print(json.dumps(pr.synthesis_template(None)))').trim();
        expect(synthesis_template(null)).toEqual(JSON.parse(expected));
    });

    it('unknown synthesis mode error text matches', () => {
        const expected = py(
            'import json\n' +
                'try:\n' +
                '    pr.synthesis_template("bogus")\n' +
                'except ValueError as e:\n' +
                '    print(json.dumps(str(e)))',
        ).trim();
        let msg = '';
        try {
            synthesis_template('bogus');
        } catch (e) {
            msg = (e as Error).message;
        }
        expect(msg).toEqual(JSON.parse(expected));
    });

    it('unknown system_prompt mode error text matches', () => {
        const expected = py(
            'import json\n' +
                'try:\n' +
                '    pr.system_prompt_for("bogus")\n' +
                'except ValueError as e:\n' +
                '    print(json.dumps(str(e)))',
        ).trim();
        let msg = '';
        try {
            system_prompt_for('bogus');
        } catch (e) {
            msg = (e as Error).message;
        }
        expect(msg).toEqual(JSON.parse(expected));
    });

    it('handoff_preamble neutrality strip matches', () => {
        const ask = 'Built on Augment\nKeep this line\nAlso uses Cline here';
        const expected = py(
            `proj = PC(name="N with Claude Code", stack="PHP", repo_purpose="Runs on Copilot agent stack.")\n` +
                `print(json.dumps(pr.handoff_preamble(proj, ${JSON.stringify(ask)})))`,
        ).trim();
        const got = handoff_preamble(
            new ProjectContext('N with Claude Code', 'PHP', 'Runs on Copilot agent stack.'),
            ask,
        );
        expect(got).toEqual(JSON.parse(expected));
    });

    it('advisor_system_prompt matches', () => {
        const expected = py(
            `print(json.dumps(pr.advisor_system_prompt("  My persona.\\n\\nMore.  ", original_ask="Hi")))`,
        ).trim();
        expect(advisor_system_prompt('  My persona.\n\nMore.  ', { original_ask: 'Hi' })).toEqual(
            JSON.parse(expected),
        );
    });

    it('build_extraction_user_prompt matches', () => {
        const analysis = 'finding with Augment\nclean finding';
        const expected = py(
            `print(json.dumps(pr.build_extraction_user_prompt(${JSON.stringify(analysis)})))`,
        ).trim();
        expect(build_extraction_user_prompt(analysis)).toEqual(JSON.parse(expected));
    });

    it('build_scoring_user_prompt matches', () => {
        const expected = py(
            'print(json.dumps(pr.build_scoring_user_prompt({"Finding-A": "alpha", "Finding-B": "beta"})))',
        ).trim();
        const got = build_scoring_user_prompt(
            new Map([
                ['Finding-A', 'alpha'],
                ['Finding-B', 'beta'],
            ]),
        );
        expect(got).toEqual(JSON.parse(expected));
    });

    it('build_peer_review_user_prompt matches', () => {
        const expected = py(
            'print(json.dumps(pr.build_peer_review_user_prompt({"Response-A": "one", "Response-B (Contra)": "two"})))',
        ).trim();
        const got = build_peer_review_user_prompt(
            new Map([
                ['Response-A', 'one'],
                ['Response-B (Contra)', 'two'],
            ]),
        );
        expect(got).toEqual(JSON.parse(expected));
    });
});
