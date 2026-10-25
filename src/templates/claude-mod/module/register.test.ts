// Run by the host's harness: `claude plugin test src/templates/claude-mod (from the repository root)`.
import { expect, test } from 'claude-code/testing'

const TURN = { answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'end_turn' } as never

function fill(body: unknown) {
  return () => ({ value: JSON.stringify(body) })
}

test('a fill file sets the status line', async ($, on) => {
  const statuses: unknown[] = []
  on('fs.exists', () => ({ value: true }))
  on('fs.read', fill({ schema_version: 1, final_context_tokens: 150000, recycle_threshold_tokens: 160000 }))
  on('ui.status', (_, e) => { statuses.push(e); return { value: undefined } })
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(TURN)
  expect(JSON.stringify(statuses)).toContain('94% of recycle threshold')
})

test('no fill file stays silent', async ($, on) => {
  const statuses: unknown[] = []
  on('fs.exists', () => ({ value: false }))
  on('ui.status', (_, e) => { statuses.push(e); return { value: undefined } })
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(TURN)
  expect(statuses.length).toBe(0)
})

test('an unknown schema version stays silent', async ($, on) => {
  const statuses: unknown[] = []
  on('fs.exists', () => ({ value: true }))
  on('fs.read', fill({ schema_version: 2, final_context_tokens: 1, recycle_threshold_tokens: 2 }))
  on('ui.status', (_, e) => { statuses.push(e); return { value: undefined } })
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(TURN)
  expect(statuses.length).toBe(0)
})
