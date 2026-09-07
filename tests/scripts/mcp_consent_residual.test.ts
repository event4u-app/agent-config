/**
 * Roadmap step 3.2 — the consent residual, and its provenance.
 *
 * The property the step is actually about is not "a line is printed": it is
 * that a documented value never reads as a verified one, and that a host nobody
 * checked never reads as a host with nothing to do. Both are pinned here.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    TOOL_TO_HOST,
    isRecorded,
    residualFor,
    residualLine,
    residualReport,
} from '../../src/scripts/_lib/mcp_consent_residual.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

describe('step 3.2 — the residual is carried per host', () => {
    it('claude carries a residual — the approval the installer cannot give', () => {
        const r = residualFor('claude');
        expect(r).not.toBeNull();
        expect(r?.residual).toContain('Approve');
        expect(r?.hostId).toBe('claude');
    });

    it('its source is `vendor-doc`, because nobody here watched it happen', () => {
        expect(residualFor('claude')?.source).toBe('vendor-doc');
    });

    it('the rendered line states the source and denies it is an observation', () => {
        const line = residualLine('claude');
        expect(line.state).toBe('residual');
        expect(line.text).toContain('source: vendor-doc');
        expect(line.text).toContain('not observed here');
    });

    it('a residual carries a citation, so the doc value is traceable', () => {
        expect(residualFor('claude')?.cite).toContain('enabledMcpjsonServers');
    });
});

describe('step 3.2 — an unchecked host is UNRECORDED, not cleared', () => {
    it('a host with no entry reads as unrecorded', () => {
        const line = residualLine('cursor');
        expect(line.state).toBe('unrecorded');
        expect(isRecorded('cursor')).toBe(false);
    });

    it('the unrecorded line says so in words — never a blank or a tick', () => {
        const text = residualLine('gemini').text;
        expect(text).toContain('nobody checked this host');
        expect(text).toContain('not the same as nothing to do');
    });

    it('an unknown host id is unrecorded too, never an error', () => {
        expect(residualLine('nosuchhost').state).toBe('unrecorded');
    });
});

describe('step 3.2 — the installer report names residuals and nothing else', () => {
    it('reports only the hosts the selected tools map to', () => {
        const lines = residualReport(['claude-code']);
        expect(lines.map((l) => l.hostId)).toEqual(['claude']);
    });

    it('a tool with no host mapping contributes no line', () => {
        expect(residualReport(['aider', 'zed', 'kiro'])).toEqual([]);
    });

    it('does not repeat a host reached by two tool ids', () => {
        const ids = Object.keys(TOOL_TO_HOST);
        const lines = residualReport([...ids, ...ids]);
        expect(new Set(lines.map((l) => l.hostId)).size).toBe(lines.length);
    });

    it('never emits a `cleared` line — a success is not actionable', () => {
        const lines = residualReport(Object.keys(TOOL_TO_HOST));
        expect(lines.every((l) => l.state !== 'cleared')).toBe(true);
    });
});

describe('step 3.2 — `doctor --check` surfaces it', () => {
    it('the check id is accepted and prints the residual with its source', () => {
        const r = spawnSync('./agent-config', ['doctor', '--check', 'mcp-consent-residual'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        expect(r.stdout).toContain('mcp-consent-residual');
        expect(r.stdout).toContain('source: vendor-doc');
        expect(r.stdout).toContain('nobody checked this host');
    });
});
