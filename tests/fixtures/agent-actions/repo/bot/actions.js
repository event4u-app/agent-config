// Synthetic fixture for agent_actions_detect — never executed.
// An agent SDK the detector does not know: it must report `unknown`, never clean.
import { defineAgentAction } from 'some-agent-kit';

export const refundOrder = defineAgentAction({
    title: 'refund_order',
    run: async (input) => input.orderId,
});
