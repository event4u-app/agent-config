// Class H under ADR-302: reads state agent-config already wrote and shows it.
// It hooks one event, declares only $.fs.exists, $.fs.read and $.ui.status, and
// decides nothing. A throw here is skipped by the host, which is the right
// failure for a reader, so no .catch is registered.
import type { Register } from 'claude-code'

// Resolved against the session's working directory, so a session started below
// the project root reads nothing and stays silent.
const FILL = 'agents/runtime/state/context-fill.json'

export const register: Register = (on) => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!(await $.fs.exists(FILL))) return result
    const fill = JSON.parse(await $.fs.read(FILL))
    if (fill?.schema_version !== 1) return result
    const tokens = fill.final_context_tokens
    const threshold = fill.recycle_threshold_tokens
    if (typeof tokens === 'number' && typeof threshold === 'number' && threshold > 0) {
      $.ui.status(`AC context ${Math.round((tokens / threshold) * 100)}% of recycle threshold`)
    }
    return result
  })
}
