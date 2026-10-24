<!-- evidence-type: analysis -->

# An escaped descendant rewrites a file channel, not a validator-stopped pipe

Exploratory fixture for step 7.1, run 2026-10-24 under D27. D27 permits
adversarial fixtures that falsify the channel assumptions and says they are
**not normative evidence**. This file reports one, and it stays exploratory.

## The question

Both seats of the third 2026-10-24 round disputed the envelope draft's E3. A
regular-file channel plus a process-group kill was claimed to stop late writes.
The seats said a descendant that leaves the group with `setsid` can still write.
openai named a validator-owned pipe as the alternative, where the validator
itself decides when collection ends. Which of these holds was a claim. This
fixture measures it.

## Method

Probe: `agents/evidence/analysis/gate-channel-escape-probe.mjs`, run as
`node agents/evidence/analysis/gate-channel-escape-probe.mjs 10`. Node v26.7.0,
darwin.

- A producer starts in its own process group (`detached: true`). It writes one
  `fail` record and a terminator.
- In the *escape* case it then starts a grandchild in a **new session**
  (`detached: true` calls `setsid`), so a kill of the producer's group misses
  it. The grandchild writes a forged `pass` record 400 ms later, after the
  producer has exited.
- The validator waits for the producer to exit, waits a 150 ms grace, then
  sends `SIGTERM` to the producer's group.
- **file**: the channel is a `0600` regular file in a `0700` `mkdtemp`
  directory. The validator reads it 800 ms after the kill.
- **pipe**: the channel is fd 3, a pipe the validator owns. The validator stops
  collecting at the kill and destroys its read end. EOF does not end it.
- **pipe-eof**: the sensitivity control. It uses the same pipe but collects
  until EOF. If the harness is sound, this variant must accept the late write.

## Result, 10 runs per cell

| Channel | Case | Forged `pass` accepted | Accepted bytes equal the producer's | Grandchild |
|---|---|---|---|---|
| file | control | 0/10 | 10/10 | — |
| file | escape | **10/10** | 0/10 | wrote 10/10 |
| pipe | control | 0/10 | 10/10 | — |
| pipe | escape | **0/10** | 10/10 | `EPIPE` 10/10 |
| pipe-eof | control | 0/10 | 10/10 | — |
| pipe-eof | escape | **10/10** | 0/10 | wrote 10/10 |

## Reading

- **E3 as drafted is refuted.** Every file-channel run with the escape accepted
  the forged record. The grandchild survived the group kill every time. The
  sentence *"a surviving grandchild cannot write after this"* is false on this
  platform, which is exactly what both seats said.
- **The pipe protects only because the validator ends collection.** pipe-eof
  accepts the forged record 10/10, and pipe accepts it 0/10. The difference is
  the validator's decision to stop reading, not the pipe itself. A pipe that is
  read until EOF is no better than a file. So the accepted-byte boundary D27
  asks for is the validator's stop point, and the outcome table has to name
  that point.
- **The boundary is a time boundary.** A late write that lands inside the grace
  window would be accepted. This fixture put the write after the grace on
  purpose, so it says nothing about writes inside the window. A record written
  inside the grace window by an escaped descendant is indistinguishable from
  one the producer wrote. The outcome table has to state that, or close it by
  stopping collection at producer exit with no grace.

## Limits

- One platform (darwin) and one Node version. D27 carries a requirement to run
  fixtures on every supported CI OS and Node version before `v0`. This run does
  not meet it.
- One producer, one late write, fixed timings. It is not a race search.
- Producer and validator share a principal. A same-principal process that can
  attach to the validator, or read its memory, is out of scope here, as it is in
  the envelope draft (L1).
- Exploratory under D27. It informs the owed outcome table and is not evidence
  that any schema is sound.
