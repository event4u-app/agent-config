// A ratification round must hand every seat ONE closing contract. Measured
// 2026-11-21/23: the final-round suffix appended the generic STANCE contract
// (`<option-label>`, `abstain` allowed) and the analysis lens's inline-findings
// block after the prompt's own ratification line, and the codex seat closed on
// something other than a ratification stance (`REQUEST_CHANGES`, no line).
import { describe, expect, it } from 'vitest';

import { CouncilResponse, ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { consult, CouncilQuestion } from '../../../src/scripts/ai_council/orchestrator.js';
import { INLINE_FINDINGS_CONTRACT, STANCE_LINE_CONTRACT } from '../../../src/scripts/ai_council/prompts.js';
import { RATIFICATION_STANCE_CONTRACT, ratificationInlineFindings, ratificationRepairOptions } from '../../../src/scripts/ai_council/ratification_prompt.js';

class Recording extends ExternalAIClient {
    prompts: string[] = [];
    constructor(private readonly reply: (call: number) => string) {
        super();
        this.name = 'openai';
        this.model = 'openai-m';
        this.transport = 'cli';
        this.billable = false;
    }
    override ask(_system: string, user_prompt: string): CouncilResponse {
        this.prompts.push(user_prompt);
        return new CouncilResponse({ provider: this.name, model: this.model, text: this.reply(this.prompts.length), error: null, latency_ms: 1 });
    }
}

const q = new CouncilQuestion({ mode: 'analysis', user_prompt: 'ratify this' });
const RATIFIED = 'Reasoning.\n\nSTANCE: ratified | CONFIDENCE: high | DEALBREAKER: no';

describe('ratification runs carry one closing contract', () => {
    it('the final round asks for the ratification stance, not the generic one, and no findings block', () => {
        const seat = new Recording(() => RATIFIED);
        consult([seat], q, null, {
            stance_tally: true,
            inline_findings: ratificationInlineFindings(true, true),
            on_stance_repair: () => true,
            ...ratificationRepairOptions(true),
        });
        const finalPrompt = seat.prompts[0] as string;
        expect(finalPrompt).toContain(RATIFICATION_STANCE_CONTRACT);
        expect(finalPrompt).not.toContain(STANCE_LINE_CONTRACT);
        expect(finalPrompt).not.toContain(INLINE_FINDINGS_CONTRACT);
    });

    it('a non-ratification run keeps the generic contract and the caller\'s findings setting', () => {
        const seat = new Recording(() => 'x\n\nSTANCE: a | CONFIDENCE: high | DEALBREAKER: no');
        consult([seat], q, null, { stance_tally: true, inline_findings: ratificationInlineFindings(true, false), ...ratificationRepairOptions(false) });
        expect(seat.prompts[0]).toContain(STANCE_LINE_CONTRACT);
        expect(seat.prompts[0]).toContain(INLINE_FINDINGS_CONTRACT);
    });

    it('a seat that closed on a review verdict is repaired onto a ratification label', () => {
        const seat = new Recording((n) => (n === 1 ? 'Findings.\n\n**REQUEST_CHANGES** — fix the timing call.' : 'STANCE: refused | CONFIDENCE: med | DEALBREAKER: yes'));
        const [r] = consult([seat], q, null, { stance_tally: true, on_stance_repair: () => true, ...ratificationRepairOptions(true) });
        expect(seat.prompts).toHaveLength(2);
        expect(r?.text.trim().endsWith('STANCE: refused | CONFIDENCE: med | DEALBREAKER: yes')).toBe(true);
    });
});
